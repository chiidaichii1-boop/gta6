// Sound, all synthesized with WebAudio: no audio files, no network, nothing to
// load. Engine hum, police sirens, gunshots, pickups and a little bassline that
// keeps the city moving. Everything is guarded: if audio is unavailable, the
// game plays silent and never throws.
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicGain = null;
  let muted = false;
  let musicStep = 0;
  let musicNext = 0;
  // A slow bassline in A minor, one bar of eight eighth-notes.
  const BASSLINE = [55, 0, 55, 65.41, 55, 0, 49, 58.27];
  const STEP_SECONDS = 60 / 112 / 2;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 800;
      sirenLfo = context.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.9;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 160;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      musicGain = context.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      musicNext = context.currentTime + 0.1;
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  function blip(freq, duration, type, volume, slideTo) {
    if (!context || muted) return;
    try {
      const osc = context.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + duration);
      const gain = context.createGain();
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + duration + 0.02);
    } catch {
      // A blip is never worth crashing the game over.
    }
  }

  function noiseBurst(duration, volume, cutoff) {
    if (!context || muted) return;
    try {
      const length = Math.floor(context.sampleRate * duration);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff || 1200;
      const gain = context.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
      // See blip.
    }
  }

  function update(dt) {
    if (!context || muted) return;
    // The bassline: schedule the next eighth-note whenever it is due.
    try {
      while (musicNext < context.currentTime + 0.12) {
        const freq = BASSLINE[musicStep % BASSLINE.length];
        if (freq > 0) {
          const osc = context.createOscillator();
          osc.type = 'square';
          osc.frequency.value = freq;
          const gain = context.createGain();
          gain.gain.setValueAtTime(0.5, musicNext);
          gain.gain.exponentialRampToValueAtTime(0.001, musicNext + STEP_SECONDS * 0.9);
          osc.connect(gain);
          gain.connect(musicGain);
          osc.start(musicNext);
          osc.stop(musicNext + STEP_SECONDS);
        }
        musicStep += 1;
        musicNext += STEP_SECONDS;
      }
    } catch {
      // Music is decoration; never let it stop the game.
    }
    void dt;
  }

  return {
    ensure,
    update,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    engine(speed01, on) {
      if (!context || !engineGain) return;
      engineGain.gain.value = on && !muted ? 0.05 + speed01 * 0.06 : 0;
      engineOsc.frequency.value = 55 + speed01 * 140;
    },
    siren(on) {
      if (!context || !sirenGain) return;
      sirenGain.gain.value = on && !muted ? 0.045 : 0;
    },
    shot() {
      noiseBurst(0.14, 0.5, 2600);
      blip(160, 0.1, 'square', 0.25, 60);
    },
    punch() {
      noiseBurst(0.08, 0.35, 900);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.3);
      blip(990, 0.14, 'sine', 0.3);
    },
    crash() {
      noiseBurst(0.25, 0.5, 700);
    },
    click() {
      blip(440, 0.06, 'square', 0.2);
    },
    jingle() {
      blip(523, 0.12, 'sine', 0.3);
      setTimeout(() => blip(659, 0.12, 'sine', 0.3), 120);
      setTimeout(() => blip(784, 0.22, 'sine', 0.3), 240);
    },
    busted() {
      blip(330, 0.25, 'sawtooth', 0.25, 110);
    },
  };
}
