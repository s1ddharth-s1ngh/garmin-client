import { Bike, Dumbbell, Flame, Footprints, HikingStick, Mountain, PersonStanding, Sparkles, WavesLadder, type LucideIcon } from 'lucide-react'
import type { Tone } from '../components/ui'
import type { Sport } from '../domain/types'

export interface SportInfo {
  label: string
  icon: LucideIcon
  tone: Tone
  /** Main speed metric shown for the sport. */
  metric: 'pace' | 'speed' | 'none'
  /** Swim pace is per 100 m. */
  swim?: boolean
}

export const SPORTS: Record<Sport, SportInfo> = {
  running: { label: 'Running', icon: Footprints, tone: 'steps', metric: 'pace' },
  trail_running: { label: 'Trail running', icon: Mountain, tone: 'train', metric: 'pace' },
  cycling: { label: 'Cycling', icon: Bike, tone: 'battery', metric: 'speed' },
  indoor_cycling: { label: 'Indoor cycling', icon: Bike, tone: 'battery', metric: 'speed' },
  walking: { label: 'Walking', icon: PersonStanding, tone: 'star', metric: 'pace' },
  hiking: { label: 'Hiking', icon: HikingStick, tone: 'train', metric: 'pace' },
  swimming: { label: 'Pool swim', icon: WavesLadder, tone: 'sleep', metric: 'pace', swim: true },
  strength: { label: 'Strength', icon: Dumbbell, tone: 'stress', metric: 'none' },
  yoga: { label: 'Yoga', icon: Sparkles, tone: 'sleep', metric: 'none' },
  hiit: { label: 'HIIT', icon: Flame, tone: 'heart', metric: 'none' },
}

/** Filter chips on the Activities screen. */
export const SPORT_GROUPS: { key: string; label: string; sports: Sport[] }[] = [
  { key: 'all', label: 'All', sports: [] },
  { key: 'run', label: 'Run', sports: ['running', 'trail_running'] },
  { key: 'ride', label: 'Ride', sports: ['cycling', 'indoor_cycling'] },
  { key: 'swim', label: 'Swim', sports: ['swimming'] },
  { key: 'walk', label: 'Walk & hike', sports: ['walking', 'hiking'] },
  { key: 'gym', label: 'Gym', sports: ['strength', 'yoga', 'hiit'] },
]
