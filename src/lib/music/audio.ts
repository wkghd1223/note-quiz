import { Note } from "@/types/music";
import { getNoteFrequency } from "./utils";

/**
 * 오디오 컨텍스트 관리 클래스
 */
class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isInitialized = false;

  /**
   * 오디오 컨텍스트 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // AudioContext 생성
      this.audioContext = new (window.AudioContext ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext)();

      // 마스터 볼륨 컨트롤
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = 0.3; // 기본 볼륨 30%

      // 사용자 상호작용 후 오디오 컨텍스트 재개
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize audio context:", error);
      throw new Error("Audio initialization failed");
    }
  }

  /**
   * 오디오 컨텍스트 가져오기
   */
  getAudioContext(): AudioContext {
    if (!this.audioContext) {
      throw new Error("Audio context not initialized");
    }
    return this.audioContext;
  }

  /**
   * 마스터 게인 노드 가져오기
   */
  getMasterGain(): GainNode {
    if (!this.masterGain) {
      throw new Error("Master gain not initialized");
    }
    return this.masterGain;
  }

  /**
   * 볼륨 설정
   */
  setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * 오디오 컨텍스트 정리
   */
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.masterGain = null;
      this.isInitialized = false;
    }
  }
}

// 싱글톤 인스턴스
const audioManager = new AudioManager();

/**
 * 단일 음표 재생
 */
export async function playNote(
  note: Note,
  duration: number = 1000,
  waveType: OscillatorType = "sine"
): Promise<void> {
  try {
    await audioManager.initialize();

    const audioContext = audioManager.getAudioContext();
    const masterGain = audioManager.getMasterGain();

    // 주파수 계산
    const frequency = getNoteFrequency(note);

    // 오실레이터 생성
    const oscillator = audioContext.createOscillator();
    oscillator.type = waveType;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

    // 게인 노드 생성 (ADSR 엔벨로프용)
    const gainNode = audioContext.createGain();

    // 오실레이터 -> 게인 -> 마스터 게인 -> 출력
    oscillator.connect(gainNode);
    gainNode.connect(masterGain);

    // ADSR 엔벨로프 적용
    const now = audioContext.currentTime;
    const attackTime = 0.01; // 10ms
    const decayTime = 0.1; // 100ms
    const sustainLevel = 0.7;
    const releaseTime = 0.3; // 300ms

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1, now + attackTime);
    gainNode.gain.linearRampToValueAtTime(
      sustainLevel,
      now + attackTime + decayTime
    );
    gainNode.gain.setValueAtTime(
      sustainLevel,
      now + duration / 1000 - releaseTime
    );
    gainNode.gain.linearRampToValueAtTime(0, now + duration / 1000);

    // 재생 시작 및 종료
    oscillator.start(now);
    oscillator.stop(now + duration / 1000);

    // Promise로 재생 완료 대기
    return new Promise((resolve) => {
      oscillator.onended = () => resolve();
    });
  } catch (error) {
    console.error("Failed to play note:", error);
    throw error;
  }
}

/**
 * 화음 재생 (여러 음표 동시 재생)
 */
export async function playChord(
  notes: Note[],
  duration: number = 1000,
  waveType: OscillatorType = "sine"
): Promise<void> {
  try {
    await audioManager.initialize();

    const promises = notes.map((note) => playNote(note, duration, waveType));
    await Promise.all(promises);
  } catch (error) {
    console.error("Failed to play chord:", error);
    throw error;
  }
}

/**
 * 아르페지오 재생 (음표들을 순차적으로 재생)
 */
export async function playArpeggio(
  notes: Note[],
  noteDuration: number = 500,
  gap: number = 100,
  waveType: OscillatorType = "sine"
): Promise<void> {
  try {
    for (let i = 0; i < notes.length; i++) {
      await playNote(notes[i], noteDuration, waveType);
      if (i < notes.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, gap));
      }
    }
  } catch (error) {
    console.error("Failed to play arpeggio:", error);
    throw error;
  }
}

/**
 * 피아노 음색으로 음표 재생
 */
export async function playPianoNote(
  note: Note,
  duration: number = 1000
): Promise<void> {
  try {
    await audioManager.initialize();

    const audioContext = audioManager.getAudioContext();
    const masterGain = audioManager.getMasterGain();

    const frequency = getNoteFrequency(note);

    // 피아노 음색을 위한 복합 오실레이터
    const fundamentalGain = audioContext.createGain();
    const harmonicGain1 = audioContext.createGain();
    const harmonicGain2 = audioContext.createGain();
    const harmonicGain3 = audioContext.createGain();

    // 기본 주파수
    const fundamental = audioContext.createOscillator();
    fundamental.type = "sine";
    fundamental.frequency.setValueAtTime(frequency, audioContext.currentTime);

    // 배음들
    const harmonic2 = audioContext.createOscillator();
    harmonic2.type = "sine";
    harmonic2.frequency.setValueAtTime(frequency * 2, audioContext.currentTime);

    const harmonic3 = audioContext.createOscillator();
    harmonic3.type = "sine";
    harmonic3.frequency.setValueAtTime(frequency * 3, audioContext.currentTime);

    const harmonic4 = audioContext.createOscillator();
    harmonic4.type = "sine";
    harmonic4.frequency.setValueAtTime(frequency * 4, audioContext.currentTime);

    // 게인 설정
    fundamentalGain.gain.value = 1.0;
    harmonicGain1.gain.value = 0.5;
    harmonicGain2.gain.value = 0.25;
    harmonicGain3.gain.value = 0.125;

    // 연결
    fundamental.connect(fundamentalGain);
    harmonic2.connect(harmonicGain1);
    harmonic3.connect(harmonicGain2);
    harmonic4.connect(harmonicGain3);

    // 마스터 게인 노드
    const noteGain = audioContext.createGain();
    fundamentalGain.connect(noteGain);
    harmonicGain1.connect(noteGain);
    harmonicGain2.connect(noteGain);
    harmonicGain3.connect(noteGain);
    noteGain.connect(masterGain);

    // 피아노 특유의 엔벨로프
    const now = audioContext.currentTime || 0;
    const attackTime = 0.005; // 5ms - 빠른 어택
    const decayTime = 0.2; // 200ms
    const sustainLevel = 0.3; // 낮은 서스테인
    const releaseTime = 0.8; // 긴 릴리즈

    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(1, now + attackTime);
    noteGain.gain.exponentialRampToValueAtTime(
      sustainLevel,
      now + attackTime + decayTime
    );
    noteGain.gain.setValueAtTime(
      sustainLevel,
      now + duration / 1000 - releaseTime
    );
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + duration / 1000);

    // 모든 오실레이터 시작
    const oscillators = [fundamental, harmonic2, harmonic3, harmonic4];
    oscillators.forEach((osc) => {
      osc.start(now);
      osc.stop(now + duration / 1000);
    });

    return new Promise((resolve) => {
      fundamental.onended = () => resolve();
    });
  } catch (error) {
    console.error("Failed to play piano note:", error);
    throw error;
  }
}

/**
 * 볼륨 설정
 */
export function setVolume(volume: number): void {
  audioManager.setVolume(volume);
}

/**
 * 오디오 시스템 초기화
 */
export async function initializeAudio(): Promise<void> {
  await audioManager.initialize();
}

/**
 * 오디오 시스템 정리
 */
export function disposeAudio(): void {
  audioManager.dispose();
}

/**
 * 오디오 컨텍스트 상태 확인
 */
export function getAudioContextState(): AudioContextState | null {
  try {
    return audioManager.getAudioContext().state;
  } catch {
    return null;
  }
}
