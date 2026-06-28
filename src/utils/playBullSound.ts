const BULL_SOUND_SRC = '/byk-mychit.mp3'

let bullAudio: HTMLAudioElement | null = null

function getBullAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null

  if (!bullAudio) {
    bullAudio = new Audio(BULL_SOUND_SRC)
    bullAudio.preload = 'auto'
  }

  return bullAudio
}

export function primeBullSound() {
  const audio = getBullAudio()
  if (!audio) return

  void audio
    .play()
    .then(() => {
      audio.pause()
      audio.currentTime = 0
    })
    .catch(() => undefined)
}

export async function playBullSound() {
  const audio = getBullAudio()
  if (!audio) return

  audio.currentTime = 0
  await audio.play().catch(() => undefined)
}
