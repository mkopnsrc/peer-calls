package pubsub

import (
	"github.com/peer-calls/peer-calls/server/identifiers"
	"github.com/peer-calls/peer-calls/server/transport"
)

type PubTrack struct {
	ClientID identifiers.ClientID `json:"clientId"`
	UserID   identifiers.UserID   `json:"userId"`
	TrackID  identifiers.TrackID  `json:"trackId"`
}

func newPubTrack(pubClientID identifiers.ClientID, track transport.Track) PubTrack {
	return PubTrack{
		ClientID: pubClientID,
		TrackID:  track.UniqueID(),
		UserID:   track.UserID(),
	}
}
