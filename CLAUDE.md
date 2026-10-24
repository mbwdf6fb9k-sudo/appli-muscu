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

## 8. Fonctions ajoutées après la première version

### Programme personnalisé (étape 7)
- Les modèles suivent `programme-muscu.md` : Dos-Biceps, Pecs-Triceps, **Jambes + rappel dos et épaules**, **Bras + épaules**, Abdos.
- Chaque exercice d'un modèle a un **objectif** : séries × fourchette de reps (ou de secondes), reps qu'il doit rester en fin de série (le « RIR » du programme, affiché en clair : « Arrête la série quand tu pourrais encore faire 1 à 2 reps. »), repos conseillé (affiché seulement, pas de minuteur), superset éventuel (A1/A2…).
- Chaque exercice a des **consignes** (technique, erreurs, remplacement), repliées derrière « Consignes » pendant la séance.
- Aujourd'hui affiche la durée de chaque séance et des conseils de placement (Jambes : pas la veille du foot ; Bras : pas le lendemain de Dos-Biceps ou Pecs-Triceps).
- Tout est modifiable dans Réglages → Exercices et modèles, qui rappelle aussi les règles du programme.

### Calendrier de régularité (Progrès, tout en haut)
- Compteurs : « X séances cette semaine · Y ce mois-ci » (muscu uniquement).
- **Série en cours** : semaines d'affilée à 3 séances ou plus. La semaine en cours ne casse pas la série tant qu'elle n'est pas finie (elle s'ajoute dès sa 3e séance) ; une semaine terminée sous 3 séances remet à zéro ; une semaine allégée compte normalement. **Meilleure série** affichée à côté.
- Calendrier du mois, du lundi au dimanche, flèches et balayage pour changer de mois, jour actuel entouré.
- Une pastille de couleur par séance (Dos-Biceps bleu, Pecs-Triceps rose, Jambes vert, Bras jaune ; couleurs vérifiées pour le daltonisme), foot (rond creux) et tennis (losange) en gris, semaines allégées teintées, légende dessous.
- Toucher un jour : les séances de ce jour (vers leur détail) et les interrupteurs **Foot** / **Tennis** (aussi pour un jour passé). Foot et tennis ne comptent pas comme muscu.

### Objectif du jour (double progression)
- Sous « La dernière fois », pour chaque exercice qui a un objectif dans son modèle. Calculé sur la **dernière séance non allégée**, **séries de travail uniquement** :
  1. toutes les séries prévues au haut de la fourchette → charge + 1 palier, objectif = bas de la fourchette ;
  2. au moins la moitié des séries sous le bas → baisser de 10 % (arrondi au palier) ;
  3. sinon → même charge, +1 rep sur les séries qui n'étaient pas au haut.
- Poids du corps : +2,5 kg de lest quand tout est au haut (jamais de baisse sans lest). Durée : +5 s.
- Première fois : « choisis une charge où tu pourrais encore faire 2 à 3 reps à la fin de la série ». Les reps et kg sont pré-remplis série par série avec l'objectif ; c'est une suggestion.
- Pendant les 14 jours qui suivent la mise en place de la fonction : bandeau « Semaines 1-2 : trouve tes charges. Arrête chaque série quand tu pourrais encore faire 2 à 3 reps. »
- **Paliers** : barre, machine, poulie et lest 2,5 kg ; haltères 2 kg. Modifiable par exercice (sa fiche dans les Réglages) ; c'est aussi le pas des boutons + / − du champ kg.

### Séries d'échauffement
- Proposées automatiquement sur le 1er exercice (≈ 50 % × 10, 70 % × 5, 85 % × 3) et sur le 2e s'il est **polyarticulaire** (70 % × 5), d'après la charge de travail du jour, arrondies au palier. Pas proposées au poids du corps sans lest ni en durée.
- Toute série peut devenir un échauffement (et inversement) depuis son panneau.
- Affichées plus discrètement (« É ») ; elles ne comptent ni dans l'objectif du jour, ni dans les records, ni dans le volume, ni dans le nombre de séries, ni dans la stagnation. Les séances enregistrées avant cette fonction sont 100 % séries de travail.

### Séries dégressives
- Après une série validée, baisser la charge puis « En dégressive de la série N » : la suite est rattachée à la même série, affichée « ↘ » et dans les lignes « 10 × 20 → 5 × 15 kg ». Plusieurs descentes possibles ; pas en durée.
- Toute série qui suit une série de travail peut devenir dégressive (et inversement) depuis son panneau, aussi dans une séance terminée.
- Une dégressive compte dans le volume, mais pas dans le nombre de séries, l'objectif du jour, les records, la stagnation, les séries par muscle ni le bilan. Si sa série principale est supprimée ou passée en échauffement, elle redevient une série normale.
- Les termes techniques sont évités dans l'appli : pas de « RIR », la consigne est écrite en clair.

### Repère de stagnation
- Un exercice est en stagnation quand aucune de ses **3 dernières séances** (de travail, hors semaine allégée) ne bat la meilleure performance des séances d'avant.
- Progresser : charge max plus haute, ou même charge max avec plus de reps au total à cette charge (poids du corps : plus de lest, ou même lest avec plus de reps ; durée : plus de secondes).
- Badge « stagnation » en séance, dans Progrès → Exercices et sur la fiche de l'exercice, avec le conseil « baisse de 10 % et remonte, ou passe à l'exercice de remplacement ». Il disparaît dès que l'exercice progresse.

### Semaine allégée
- Carte sur Aujourd'hui, 6 semaines après la première séance faite avec cette fonction (ou après la dernière semaine allégée), ou plus tôt si 3 exercices ou plus stagnent. « Activer » ou « Plus tard » (revient 3 jours après).
- Active 7 jours (arrêtable avant) : moitié moins de séries (arrondi au supérieur), mêmes charges, arrêt de chaque série quand il reste 3 à 4 reps possibles. Ces séances sont marquées « allégée » : elles comptent dans le calendrier et les records, mais pas dans l'objectif du jour ni la stagnation.

### Mensurations (Mon année)
- Bras (contracté), poitrine, épaules, taille (au nombril), cuisse, en cm, chacune facultative. Une mesure par jour au plus (la dernière remplace), pré-remplie avec la précédente, avec la méthode rappelée.
- Dernière valeur et écart depuis la première mesure, rapport **épaules / taille** (proportions « en V »), courbe par mesure, liste modifiable et supprimable.
- Rappel discret au-delà de 30 jours sans mesure.

### Photos d'évolution (Mon année)
- Ajout depuis l'appareil photo ou la photothèque, pose **Face / Profil / Dos**, date modifiable. Réduite à 1280 px (JPEG) pour rester légère.
- Vignettes rangées par mois, agrandissement et suppression (avec confirmation), **comparaison côte à côte** de deux dates pour une même pose.
- Les photos restent uniquement sur le téléphone et sont incluses dans l'export (la place prise est affichée).

### Séries par muscle (Progrès)
- Carte sous le graphique des séances par semaine : séries de travail (sans échauffements) par muscle, **semaine en cours** ou **moyenne des 4 dernières semaines terminées** (seulement depuis la première séance).
- Repère indicatif 10 à 20 séries par semaine et par muscle (hors abdos) ; un muscle sous 10 en moyenne est marqué « en retard ».
- Chaque exercice a un **muscle principal** (Dos, Pecs, Épaules, Biceps, Triceps, Quadriceps, Ischios-fessiers, Mollets, Abdos), modifiable dans sa fiche ; sans muscle, il compte dans « Autre ».

### Bilan du mois (Progrès)
- Lien « Bilan d'octobre » sous le calendrier (suit le mois affiché) ; carte « Ton bilan d'octobre est prêt » sur Aujourd'hui les 7 premiers jours du mois suivant, jusqu'à ce qu'il soit vu ou fermé.
- Contenu calculé à partir des données : séances (et écart avec le mois d'avant), répartition par type, semaines à 3 séances ou plus, temps à la salle, foot/tennis, semaine allégée, séries de travail, volume, records battus, les 3 exercices qui progressent le plus (1RM estimé, reps au poids du corps, secondes en durée), séries par muscle, poids (moyenne 7 jours) en début et fin de mois, dernières mensurations comparées aux précédentes, photos du mois.

### Données
- Version 6 de la base : table `activities` (foot/tennis), `warmup` sur les séries, `deload` sur les séances, `compound` (polyarticulaire) sur les exercices, réglages `featureStartAt`, `deloadPeriods`, `deloadSnoozedUntil`. La migration ne perd rien ; l'export inclut tout et les anciens exports sont convertis à l'import.
- Version 7 (étape 9) : tables `measurements` (une ligne par jour) et `photos` (image JPEG en texte, date, pose), `muscle` sur les exercices (rempli par la migration sans écraser un choix existant), réglage `monthlyReviewSeen`. Même règle : migration sans perte, export complet, anciens exports convertis à l'import.
- Étape 10 : champ facultatif `drop` sur les séries (suite dégressive). Les séries existantes n'ont pas ce champ et restent des séries normales : pas de nouvelle version de la base.

## Plus tard (pas dans la première version)
- ~~Suggestion d'augmenter la charge quand toutes les reps sont réussies.~~ Fait : objectif du jour (section 8).
- ~~Calendrier de régularité.~~ Fait : section 8.
- ~~Mensurations.~~ Fait : section 8.
