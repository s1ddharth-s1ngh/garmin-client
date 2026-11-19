import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import AppShell from './app/AppShell'
import { SessionProvider, useSessionState } from './app/session'
import { ToastProvider } from './components/toast'
import ActivitiesScreen from './screens/ActivitiesScreen'
import ActivityScreen from './screens/ActivityScreen'
import AuthScreen from './screens/AuthScreen'
import ConnectScreen from './screens/ConnectScreen'
import HealthScreen from './screens/HealthScreen'
import MetricScreen from './screens/MetricScreen'
import ProfileScreen from './screens/ProfileScreen'
import SettingsScreen from './screens/SettingsScreen'
import SleepScreen from './screens/SleepScreen'
import TodayScreen from './screens/TodayScreen'
import TrainingScreen from './screens/TrainingScreen'

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-16 animate-pulse rounded-[20px]" />
    </div>
  )
}

function Gate() {
  const state = useSessionState()
  if (state.status === 'loading') return <Splash />
  if (state.status === 'signed-out') return <AuthScreen />
  if (!state.session.garmin) return <ConnectScreen />
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<TodayScreen />} />
        <Route path="activities" element={<ActivitiesScreen />} />
        <Route path="training" element={<TrainingScreen />} />
        <Route path="health" element={<HealthScreen />} />
        <Route path="health/:metric" element={<MetricScreen />} />
        <Route path="sleep" element={<SleepScreen />} />
        <Route path="profile" element={<ProfileScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      {/* Full screen, no tab bar: the map and charts get the whole height. */}
      <Route path="activities/:id" element={<ActivityScreen />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ToastProvider>
        <SessionProvider>
          <Gate />
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
