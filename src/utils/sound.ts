import { getCachedSettings } from '@/src/stores/settings';

type SoundCue = 'roll' | 'capture' | 'win' | 'tap';

export const sound = {
  async play(cue: SoundCue) {
    const settings = getCachedSettings();
    if (!settings.soundEnabled) return;
    // Audio assets are not delivered yet. This facade keeps all call sites
    // behind the settings toggle so real SFX can be dropped in without UI edits.
    void cue;
  },

  async music(enabled = getCachedSettings().musicEnabled) {
    void enabled;
  },
};
