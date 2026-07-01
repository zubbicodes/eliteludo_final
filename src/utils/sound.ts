import { getCachedSettings } from '@/src/stores/settings';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

type SoundCue = 
  | 'tap'           // Button clicks
  | 'roll'          // Dice roll
  | 'capture'       // Token kill
  | 'finish'        // Token win/finish
  | 'coin'          // Coin collection
  | 'gem'           // Gem collection
  | 'victory'       // Game win
  | 'defeat';       // Game loss

// Sound file paths (you'll need to add these to assets/audio/)
// For now, we'll use a type-safe approach that doesn't require the files to exist yet
const soundAssets: Partial<Record<SoundCue, any>> = {
  // Uncomment these once you add the audio files to assets/audio/
   tap: require('@/assets/audio/tap.m4a'),
   roll: require('@/assets/audio/dice_roll.mp3'),
   capture: require('@/assets/audio/capture.mp3'),
   finish: require('@/assets/audio/token_move.mp3'),
   coin: require('@/assets/audio/coin.mp3'),
   gem: require('@/assets/audio/gem.mp3'),
  // victory: require('@/assets/audio/victory.mp3'),
   defeat: require('@/assets/audio/defeat.mp3'),
};

// Cache loaded sounds
const soundCache = new Map<SoundCue, AudioPlayer>();

export const sound = {
  async play(cue: SoundCue) {
    const settings = getCachedSettings();
    if (!settings.soundEnabled) return;
    
    const asset = soundAssets[cue];
    if (!asset) {
      console.log(`Sound asset "${cue}" not added yet. Skipping playback.`);
      return;
    }

    try {
      let soundObj = soundCache.get(cue);
      if (!soundObj) {
        const newSound = createAudioPlayer(asset);
        soundCache.set(cue, newSound);
        soundObj = newSound;
      }

      await soundObj.seekTo(0);
      soundObj.play();
    } catch (error) {
      console.warn(`Failed to play sound "${cue}":`, error);
    }
  },

  async music(enabled = getCachedSettings().musicEnabled) {
    // Background music logic can be added here
    void enabled;
  },

  async preload() {
    // Preload all sounds for better performance
    for (const [cue, asset] of Object.entries(soundAssets) as [SoundCue, any][]) {
      try {
        if (!soundCache.has(cue)) {
          const sound = createAudioPlayer(asset);
          soundCache.set(cue, sound);
        }
      } catch (error) {
        console.warn(`Failed to preload sound "${cue}":`, error);
      }
    }
  },

  async unload() {
    // Unload all sounds to free memory
    for (const [, soundObj] of soundCache) {
      soundObj.remove();
    }
    soundCache.clear();
  },
};
