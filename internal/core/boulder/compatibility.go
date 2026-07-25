package boulder

import (
	"encoding/json"
	"errors"
	"os"

	"lazygrok/internal/core/state"
)

var errLegacyStateFormat = errors.New("legacy boulder state format")

// LoadCurrent reads current-format state and defers legacy state to the compatibility pipeline.
func LoadCurrent(workspace string) (*BoulderState, error) {
	data, err := state.Read(boulderPath(workspace))
	if err != nil {
		if os.IsNotExist(err) {
			return Load(workspace)
		}
		return nil, err
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	if _, legacy := raw["schema_version"]; legacy {
		return nil, errLegacyStateFormat
	}
	return Load(workspace)
}
