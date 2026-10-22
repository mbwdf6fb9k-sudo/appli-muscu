# Appli Muscu — cahier des charges

Application de musculation **pour mon usage personnel uniquement**, sur iPhone.
Pas de compte, pas d'inscription, pas de serveur, pas de réseau social, pas de pub, pas de tracking.
Toute l'interface est en **français**, les charges en **kg**.

---

## 1. Technique

- **Web app installable (PWA)**, ajoutée à l'écran d'accueil depuis Safari, qui s'ouvre en plein écran comme une vraie appli.
- **Fonctionne hors ligne** : à la salle, le réseau est mauvais.
- **Hébergement** : GitHub Pages, déployé automatiquement à chaque push via GitHub Actions. Penser au chemin de base du dépôt (base path).
- **Stack proposée** : Vite + React + TypeScript, stockage local en IndexedDB (Dexie), graphiques avec une librairie légère (Recharts ou Chart.js), vite-plugin-pwa pour le service worker et le manifest.
- **Données** : 100 % sur le téléphone. Demander le stockage persistant (`navigator.storage.persist()`).
- **Sauvegarde** : export et import de toutes les données en un fichier JSON. Afficher « Dernière sauvegarde il y a X jours » et rappeler gentiment d'exporter si ça fait plus de 14 jours.
- **Quand une nouvelle version est déployée**, l'appli se met à jour toute seule, sans perdre les données.

### Spécificités iPhone (indispensable)
- Manifest + `apple-touch-icon` + `apple-mobile-web-app-capable`, affichage `standalone`.
- Respect des zones sûres (encoche, barre du bas) avec `env(safe-area-inset-*)`.
- Champs de saisie en taille de police ≥ 16 px pour éviter le zoom automatique de Safari.
- Grandes zones tactiles (≥ 44 px), utilisable à une main, entre deux séries.
- Pas de rebond ou de défilement parasite de toute la page.

### Design
- **Thème sombre par défaut** (lisible à la salle), avec une couleur d'accent unique. Thème clair disponible dans les réglages.
- Sobre, moderne, rapide. Transitions douces, jamais de lenteur.
- Navigation par une barre d'onglets en bas : **Aujourd'hui · Progrès · Mon année · Compléments**.

---

## 2. Aujourd'hui (écran d'accueil)

- Je choisis moi-même ce que je fais aujourd'hui. **L'appli n'impose jamais de séance** et ne suit pas de rotation fixe.
- Choix possibles : **Dos-Biceps · Pecs-Triceps · Jambes · Bras (+ épaules) · Repos**.
- Sous chaque séance, une info discrète : « faite il y a X jours » (ou « jamais faite »).
- Champ optionnel **« J'y vais vers… »** (heure prévue) : sert à placer les compléments d'avant-séance (voir section 6).
- Choisir une séance fait passer la journée en **jour d'entraînement**. Sans choix, c'est un **jour de repos**.
- Bouton **Commencer la séance**.

## 3. Séance en cours

- La séance démarre avec les exercices de son modèle (listes ci-dessous). Je peux **ajouter, retirer et réordonner** des exercices pour cette séance, et choisir de modifier aussi le modèle.
- Un bouton **+ Abdos** ajoute des exercices d'abdos à n'importe quelle séance (j'en fais un peu à chaque fois).
- Pour chaque exercice :
  - Affichage bien visible de **la dernière fois** sur cet exercice : séries, reps, charges et date. Si c'est la première fois : « Première fois ».
  - Saisie d'une série en 2-3 touches : **reps** et **kg** avec boutons + / − (pas de 2,5 kg par défaut, modifiable), pré-remplis avec les valeurs de la dernière fois.
  - Bouton pour valider la série, bouton pour la dupliquer.
  - Note libre optionnelle (réglage de machine, sensation…).
- **Types d'exercices à gérer** :
  - Charge × reps (cas normal).
  - Poids du corps (tractions, dips…) : le champ kg sert au lest (0 = poids du corps).
  - Durée (gainage) : saisie en secondes.
- **Pas de minuteur de repos** (je n'en veux pas).
- **Terminer la séance** : résumé avec durée, nombre de séries, volume total (kg × reps) et **records battus** mis en avant.
- Si je ferme l'appli en pleine séance, je la retrouve intacte en revenant.

### Exercices pré-remplis (tous modifiables dans l'appli)
Je m'entraîne toujours à Fitness Park, avec des machines guidées, des poulies et des poids libres. Mes charges actuelles ne sont pas connues : elles viendront de mes premières séances.

**Dos-Biceps** : Tractions · Tirage vertical · Rowing barre · Rowing haltère · Tirage horizontal assis · Pull-over poulie · Curl barre EZ · Curl incliné haltères · Curl marteau

**Pecs-Triceps** : Développé couché barre · Développé incliné haltères · Écarté poulie vis-à-vis · Dips · Extension triceps poulie haute (corde) · Barre au front · Extension triceps au-dessus de la tête

**Jambes** : Squat · Presse à cuisses · Fentes bulgares · Leg extension · Leg curl · Soulevé de terre roumain · Hip thrust · Mollets debout

**Bras (+ épaules)** : Développé militaire haltères · Élévations latérales · Oiseau / reverse pec deck · Face pull · Shrugs · Curl pupitre · Curl haltères · Extension triceps poulie · Kickback

**Abdos** : Crunch poulie · Relevés de jambes suspendu · Roue abdominale · Gainage (durée)

## 4. Progrès (records et graphiques, dès la première version)

- **Historique** de toutes mes séances, avec le détail de chacune, modifiable et supprimable.
- **Records par exercice** :
  - charge maximale (quel que soit le nombre de reps),
  - meilleur **1RM estimé** (formule d'Epley : kg × (1 + reps / 30), calculé seulement pour les séries de 12 reps ou moins),
  - pour le poids du corps : maximum de reps (et de lest),
  - pour le gainage : meilleure durée.
- **Petite célébration** (animation discrète + vibration si possible) quand je bats un record pendant la séance.
- **Graphique de progression par exercice** : 1RM estimé par séance dans le temps, avec bascule vers la charge max.
- Petit graphique du **nombre de séances par semaine**.

## 5. Mon année

- **Profil** : 21 ans, 1,77 m, poids de départ 74 kg (octobre 2026). Tout est modifiable.
- **Objectif de l'année** : être « stock et esthétique », donc prise de muscle propre avec des proportions équilibrées. Champ « poids visé » optionnel.
- **Pesée rapide** en un geste (une valeur par jour max, la dernière remplace).
- **Courbe du poids** sur l'année, avec une **moyenne glissante sur 7 jours** pour lisser les variations quotidiennes, et l'écart depuis le poids de départ.
- Repère affiché dans le profil : **protéines visées ≈ 120 à 150 g par jour** (1,6 à 2 g par kg). Information seulement, pas de compteur.

## 6. Compléments

Liste **modifiable** (ajouter, retirer, changer le moment de prise). Chaque prise est une **case à cocher**, remise à zéro chaque jour. Je vois d'un coup d'œil ce que j'ai déjà pris aujourd'hui.

Le planning du jour dépend du type de journée (section 2).

### Jour d'entraînement
| Moment | Compléments |
|---|---|
| Petit-déjeuner | Bion 3 |
| Déjeuner | Vitamine D3 · Oméga 3 |
| ~45 min avant la séance | Collagène + vitamine C |
| 20-30 min avant la séance | Préworkout |
| Pendant la séance | BCAA |
| Après la séance | Créatine (3 à 5 g) |
| Coucher | Magnésium bisglycinate · Ashwagandha KSM-66 |

### Jour de repos
| Moment | Compléments |
|---|---|
| Petit-déjeuner | Bion 3 · Collagène + vitamine C |
| Déjeuner | Vitamine D3 · Oméga 3 · Créatine (3 à 5 g) |
| Coucher | Magnésium bisglycinate · Ashwagandha KSM-66 |

- Si j'ai indiqué une heure de séance, les prises « avant la séance » affichent une **heure précise** (ex. séance à 18 h → collagène 17 h 15, préworkout 17 h 30). Sinon, elles restent en « avant la séance ».
- Si la séance est prévue **après 18 h**, afficher un petit avertissement sous le préworkout : il contient souvent de la caféine, ce qui peut gêner le sommeil.
- La créatine se prend **tous les jours**, même au repos : c'est la régularité qui compte.

---

## 7. Règles de travail pour Claude Code

- **Toujours commencer en mode plan** pour une nouvelle étape : proposer l'architecture et les étapes, attendre ma validation, puis coder.
- Construire **une étape à la fois**, dans cet ordre :
  1. Socle : projet, PWA installable, onglets, stockage local, export/import, déploiement GitHub Pages.
  2. Séances : choix du jour, modèles et exercices pré-remplis, saisie, « dernière fois », fin de séance.
  3. Progrès : historique, records, graphiques.
  4. Mon année : profil, pesées, courbe.
  5. Compléments : planning entraînement/repos, cases à cocher, heures calculées.
  6. Finitions : icône, animations, célébration des records, relecture complète sur iPhone.
- **Un commit Git clair après chaque étape qui fonctionne.**
- Tester chaque écran en vue mobile (largeur iPhone) avant de dire qu'une étape est finie.
- Ne jamais supprimer ni casser les données existantes quand le modèle de données évolue : prévoir des migrations.
- Je ne suis pas développeur : explique-moi simplement ce que tu fais et ce que je dois tester sur mon téléphone.

## Plus tard (pas dans la première version)
- Suggestion d'augmenter la charge quand toutes les reps sont réussies.
- Calendrier de régularité.
- Mensurations.
