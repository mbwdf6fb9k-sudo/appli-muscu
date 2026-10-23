import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { db } from './db/database'
import { useSettings } from './db/settings'
import { useApplyTheme } from './lib/theme'
import { Aujourdhui } from './screens/Aujourdhui'
import { BilanMois } from './screens/BilanMois'
import { Complements } from './screens/Complements'
import { ComplementsListe } from './screens/ComplementsListe'
import { ExerciceProgres } from './screens/ExerciceProgres'
import { Exercices } from './screens/Exercices'
import { ModeleEdition } from './screens/ModeleEdition'
import { MonAnnee } from './screens/MonAnnee'
import { Progres } from './screens/Progres'
import { Reglages } from './screens/Reglages'
import { Seance } from './screens/Seance'
import { SeanceResume } from './screens/SeanceResume'

export default function App() {
  useApplyTheme(useSettings()?.theme)

  return (
    <HashRouter>
      <Layout />
    </HashRouter>
  )
}

function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  // Pendant une séance, pas de barre d'onglets : l'écran reste concentré sur la saisie
  const inSession = location.pathname.startsWith('/seance')

  // Au lancement, on rouvre directement la séance en cours
  useEffect(() => {
    if (location.pathname !== '/') return
    void db.sessions
      .where('status')
      .equals('active')
      .first()
      .then((active) => active && navigate('/seance', { replace: true }))
  }, []) // seulement au démarrage

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Aujourdhui />} />
        <Route path="/seance" element={<Seance />} />
        <Route path="/seance/:id/resume" element={<SeanceResume mode="resume" />} />
        <Route path="/progres" element={<Progres />} />
        <Route path="/progres/seance/:id" element={<SeanceResume key="history" mode="history" />} />
        <Route path="/progres/exercice/:id" element={<ExerciceProgres />} />
        <Route path="/progres/bilan/:mois" element={<BilanMois />} />
        <Route path="/annee" element={<MonAnnee />} />
        <Route path="/complements" element={<Complements />} />
        <Route path="/complements/liste" element={<ComplementsListe />} />
        <Route path="/reglages" element={<Reglages />} />
        <Route path="/reglages/exercices" element={<Exercices />} />
        <Route path="/reglages/modeles/:id" element={<ModeleEdition />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!inSession && <TabBar />}
    </div>
  )
}
