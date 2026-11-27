/* The reverb: a long, dark space.

   One long ConvolverNode is not safe here. Browsers convolve only the head of an impulse on the audio thread and hand
   the rest to a normal-priority helper thread; when the machine is busy (the 3D scene on a small GPU) that hand-over
   stalls the audio thread, measured as hundreds of dropouts a minute. So the convolver carries just the head of the
   impulse (short enough to stay on the audio thread, see reverbHead in core.ts), and the long tail is a feedback
   delay network fed by it: eight delay lines mixed through a Householder matrix, which costs next to nothing. */

/** decay time of the tail in seconds (what the six-second impulse measures under the mix's low-pass) */
const RT60 = 4.9
/** line lengths in seconds: spread, with no simple ratios between them */
const LINES = [0.1733, 0.2089, 0.2477, 0.2903, 0.3371, 0.3889, 0.4463, 0.5101]
/** tail level against the head, set so the decay curve follows the full six-second impulse this replaces */
const TAIL = 0.33

export function createReverb(ac: BaseAudioContext, head: AudioBuffer) {
  const conv = ac.createConvolver()
  conv.normalize = false // the head is already scaled as the full impulse would have been
  conv.buffer = head
  const out = ac.createGain()
  conv.connect(out)

  const n = LINES.length
  const split = ac.createChannelSplitter(2)
  const merge = ac.createChannelMerger(2)
  // Householder mixing: every line gets its own signal back, minus a share of all of them
  const share = ac.createGain()
  share.gain.value = -2 / n
  conv.connect(split)
  for (let i = 0; i < n; i++) {
    const line = ac.createDelay(1)
    line.delayTime.value = LINES[i]
    // the space darkens as it decays
    const damp = ac.createBiquadFilter()
    damp.type = 'lowpass'
    damp.frequency.value = Math.min(8000, ac.sampleRate * 0.45)
    damp.Q.value = 0.5
    const back = ac.createGain()
    back.gain.value = Math.pow(10, (-3 * LINES[i]) / RT60)
    split.connect(line, i % 2)
    line.connect(damp).connect(back)
    back.connect(line)
    back.connect(share)
    share.connect(line)
    line.connect(merge, 0, i % 2)
  }
  const tail = ac.createGain()
  // a shorter head (higher sample rates) feeds the lines less, so the tail is lifted to match
  tail.gain.value = TAIL * Math.sqrt(0.5 / head.duration)
  merge.connect(tail).connect(out)
  return { input: conv as AudioNode, output: out as AudioNode }
}
