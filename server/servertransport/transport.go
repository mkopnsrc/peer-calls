package servertransport

import (
	"fmt"
	"io"
	"sync"

	"github.com/juju/errors"
	"github.com/peer-calls/peer-calls/server/codecs"
	"github.com/peer-calls/peer-calls/server/identifiers"
	"github.com/peer-calls/peer-calls/server/logger"
	"github.com/peer-calls/peer-calls/server/multierr"
	"github.com/peer-calls/peer-calls/server/transport"
	"github.com/peer-calls/peer-calls/server/uuid"
	"github.com/pion/interceptor"
)

const (
	// TODO reduce this.
	ReceiveMTU int = 8192
)

var (
	ErrNoData        = errors.Errorf("cannot handle empty buffer")
	ErrUnknownPacket = errors.Errorf("unknown packet")
)

// Transport is used for server to server communication. The underlying
// transport protocol is SCTP, and the following data is transferred:
//
// 1. Ordered Metadata stream on ID 0. This stream will contain track, as well
//    as application level metadata.
// 2. Unordered Media (RTP and RTCP) streams will use odd numbered stream IDs,
//    starting from 1.
// 3. Ordered DataChannel messages on even stream IDs, starting from 2.
//
// A single Media stream transports all RTP and RTCP packets for a single
// room, and a single DataChannel stream will transport all datachannel
// messages for a single room.
//
// A single SCTP connection can be used to transport packets from multiple
// rooms. Each room will take exactly one Media stream and one DataChannel
// stream. Following the rules above, the stream IDs for a specific room
// will always be N and N+1, but the metadata for all rooms will be sent on
// stream 0.
//
// Track metadata is JSON encoded.
//
// TODO subject to change
type Transport struct {
	*MetadataTransport
	*MediaStream
	*DataTransport

	clientID  identifiers.ClientID
	closeChan chan struct{}
	closeOnce sync.Once
}

type Params struct {
	Log           logger.Logger
	MediaConn     io.ReadWriteCloser
	DataConn      io.ReadWriteCloser
	MetadataConn  io.ReadWriteCloser
	Interceptor   interceptor.Interceptor
	CodecRegistry *codecs.Registry
}

func New(params Params) *Transport {
	if params.Interceptor == nil {
		params.Interceptor = &interceptor.NoOp{}
	}

	if params.CodecRegistry == nil {
		params.CodecRegistry = codecs.NewRegistryDefault()
	}

	clientID := identifiers.ClientID(fmt.Sprintf("%s%s", identifiers.ServerNodePrefix, uuid.New()))
	log := params.Log.WithNamespaceAppended("server_transport").WithCtx(logger.Ctx{
		"client_id": clientID,
	})
	log.Info("NewTransport", nil)

	mediaStream := NewMediaStream(MediaStreamParams{
		Log:           log,
		Conn:          params.MediaConn,
		Interceptor:   params.Interceptor,
		BufferFactory: nil,
	})

	metadataTransportParams := MetadataTransportParams{
		Log:           log,
		Conn:          params.MetadataConn,
		MediaStream:   mediaStream,
		ClientID:      clientID,
		Interceptor:   params.Interceptor,
		CodecRegistry: params.CodecRegistry,
	}

	dataTransportParams := DataTransportParams{
		Log:  log,
		Conn: params.DataConn,
	}

	return &Transport{
		MetadataTransport: NewMetadataTransport(metadataTransportParams),
		MediaStream:       mediaStream,
		DataTransport:     NewDataTransport(dataTransportParams),
		clientID:          clientID,
		closeChan:         make(chan struct{}),
	}
}

var _ transport.Transport = &Transport{}

func (t *Transport) ClientID() identifiers.ClientID {
	return t.clientID
}

func (t *Transport) Done() <-chan struct{} {
	return t.closeChan
}

func (t *Transport) Close() (err error) {
	errs := multierr.New()

	errs.Add(errors.Trace(t.DataTransport.Close()))
	errs.Add(errors.Trace(t.MediaStream.Close()))
	errs.Add(errors.Trace(t.MetadataTransport.Close()))

	t.closeOnce.Do(func() {
		close(t.closeChan)
	})

	return errors.Trace(errs.Err())
}

func (t *Transport) Type() transport.Type {
	return transport.TypeServer
}
