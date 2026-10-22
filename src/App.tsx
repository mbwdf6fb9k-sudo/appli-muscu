import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { useSettings } from './db/settings'
import { useApplyTheme } from './lib/theme'
import { Aujourdhui } from './screens/Aujourdhui'
import { Complements } from './screens/Complements'
import { MonAnnee } from './screens/MonAnnee'
import { Progres } from './screens/Progres'
import { Reglages } from './screens/Reglages'

export default function App() {
  useApplyTheme(useSettings()?.theme)

  return (
    <HashRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<Aujourdhui />} />
          <Route path="/progres" element={<Progres />} />
          <Route path="/annee" element={<MonAnnee />} />
          <Route path="/complements" element={<Complements />} />
          <Route path="/reglages" element={<Reglages />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <TabBar />
      </div>
    </HashRouter>
  )
}
