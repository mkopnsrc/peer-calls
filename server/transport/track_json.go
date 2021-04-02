package transport

import "github.com/peer-calls/peer-calls/server/identifiers"

type TrackJSON struct {
	ID       string             `json:"id"`
	StreamID string             `json:"streamID"`
	PeerID   identifiers.PeerID `json:"peerId"`
	Codec    Codec              `json:"codec"`
}
