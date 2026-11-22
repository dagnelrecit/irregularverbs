# IrregularVerbs — Pratique des verbes irréguliers (2e secondaire)

Application Web statique (HTML, CSS, JavaScript) hébergée gratuitement sur **GitHub Pages**, avec une **feuille Google** comme base de données (via Google Apps Script).

---

## 📁 Contenu du dossier

```
index.html            ← application élève
enseignant.html       ← espace enseignant (NIP)
css/styles.css        ← design (clair/sombre, responsive)
js/config.js          ← ⚠️ LE fichier à modifier (URL du script)
js/verbes-defaut.js   ← liste par défaut (4 blocs × 25 verbes)
js/commun.js          ← outils communs (validation, familles, audio…)
js/app.js             ← logique élève
js/enseignant.js      ← logique enseignant
sw.js, manifest.webmanifest, assets/  ← mode hors-ligne et application installable
apps-script/Code.gs   ← code à coller dans Google Apps Script
```

---

## Étape 1 — Créer la base de données (Google Sheets), environ 10 minutes

1. Va sur <https://sheets.google.com> et crée une **feuille vide**. Nomme-la par exemple « Verbes irréguliers — résultats ».
2. Menu **Extensions › Apps Script**.
3. Efface le contenu de `Code.gs`, colle **tout** le contenu du fichier `apps-script/Code.gs`, puis clique 💾 **Enregistrer**.
4. Retourne dans la feuille et **recharge la page** (F5). Un menu **« Verbes irréguliers »** apparaît à droite d'« Aide ».
5. Menu **Verbes irréguliers › 1. Préparer la feuille**. Google demande une autorisation la première fois :
   *Continuer › choisis ton compte › Paramètres avancés › Accéder au projet (non sécurisé) › Autoriser*.
   C'est normal : c'est ton propre script.
6. Menu **Verbes irréguliers › 2. Définir ou changer le NIP administrateur**, puis choisis un NIP de 4 à 8 chiffres. Sur le site, tu te connecteras avec l'identifiant **admin** et ce NIP.
7. Dans Apps Script : **Déployer › Nouveau déploiement**
   - Type (⚙️) : **Application Web**
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
   - Clique sur **Déployer** et copie l'**URL de l'application Web** (elle se termine par `/exec`).

> 💡 **Test rapide :** colle l'URL suivie de `?action=ping` dans ton navigateur. Tu dois voir `{"ok":true,"message":"Le script fonctionne."}`.

> ⚠️ **Si tu modifies `Code.gs` plus tard :** *Déployer › Gérer les déploiements › ✏️ › Version : Nouvelle version › Déployer*. L'URL reste la même.

## Étape 2 — Brancher le site sur la feuille

Ouvre `js/config.js` et remplace `VOTRE_URL_ICI` par ton URL :

```js
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfy…/exec";
```

## Étape 3 — Mettre en ligne sur GitHub Pages, environ 5 minutes

1. Connecte-toi à <https://github.com> et clique sur **New repository**. Nom suggéré : `verbes-irreguliers`. Choisis **Public** et clique sur **Create repository**.
2. Clique sur **uploading an existing file**, glisse **tout le contenu** du dossier (pas le dossier lui-même : `index.html` doit être à la racine), puis **Commit changes**.
3. Va dans **Settings › Pages**. Sous *Branch*, choisis **main** et **/(root)**, puis clique sur **Save**.
4. Après 1 ou 2 minutes, ton site est en ligne à l'adresse `https://TON-NOM.github.io/verbes-irreguliers/`.
5. L'espace enseignant se trouve à `…/verbes-irreguliers/enseignant.html` (il y a aussi un lien discret au bas de l'application).

> Pour mettre le site à jour, téléverse le fichier modifié dans GitHub. Si les élèves voient encore l'ancienne version, change `VERSION` dans `sw.js` (ex. `iv-v2`).

---

## 👩‍🏫 Utilisation en classe

### Pour les élèves
- **Connexion** : l'élève choisit son **école** dans une liste, puis entre son numéro de groupe et ses initiales (ex. École Saint-Jean · `21-DC`). Si deux élèves d'un groupe ont les mêmes initiales, l'un ou l'une ajoute un chiffre (`21-DC2`). Aucun nom complet n'est enregistré (Loi 25).
- **NIP personnel** : à la première connexion, l'élève choisit un NIP de 4 chiffres. Ce NIP est ensuite demandé à chaque connexion, ce qui empêche un autre élève d'utiliser son code. En cas d'oubli, l'enseignant le réinitialise dans la fiche de l'élève, et la progression est conservée.
- **Progression sur tous les appareils** : la progression (verbes maîtrisés, XP, badges, records) est sauvegardée dans la feuille Google. L'élève la retrouve sur n'importe quel Chromebook, ordinateur ou cellulaire.
- Sur un **Chromebook partagé**, les codes déjà utilisés apparaissent comme raccourcis, mais le NIP est toujours demandé. La session se ferme à la fermeture du navigateur.
- On choisit un **bloc** (1 à 4), puis une **activité** :

| Activité | Description |
|---|---|
| 📖 Étudier | Verbes regroupés par **familles** (cut-cut-cut, sing-sang-sung…). On cache une colonne pour s'autotester. |
| 🎯 Entraînement | 15 questions choisies par **répétition espacée** : les verbes ratés reviennent plus souvent. Indices permis. |
| 📝 Quiz | 20 questions notées. Un indice divise les points de la question par deux. |
| 🧠 Mes verbes difficiles | Seulement les verbes ratés la dernière fois. |
| ✍️ Phrases à compléter | Une phrase avec le verbe entre parenthèses à mettre au bon temps : passé simple, participe passé, infinitif (après *did*, *will*, *can*…) ou présent (*he goes*). La correction met en évidence l'indice de temps (*yesterday*, *have you ever*…) et explique la règle. |
| 🕵️ Chasse aux erreurs | 5 phrases par manche, dont 2 ou 3 contiennent un verbe mal conjugué (*buyed*, *have went*, *did saw*, *she go*…). L'élève clique sur les erreurs et les corrige. 4 manches. |
| ⚡ Sprint 60 s | Le plus de verbes possible en une minute, sans indice. Un record est conservé par bloc. |
| ✅ Vrai ou faux éclair | *go → went → goed* ? Vrai ou faux, le plus vite possible en 60 s (flèches du clavier ou glissement sur cellulaire). |

- **Format des questions** : une des 4 formes est donnée (infinitif, passé, participe ou français) et l'élève complète les 3 autres. Le menu « Options » permet de fixer la forme donnée (par défaut : au hasard).
- **Validation** : majuscules et espaces ignorés, variantes acceptées (`learned/learnt`, `was/were`, `got/gotten`), `to go` accepté, accents non exigés en français, **aucune faute d'orthographe tolérée**.
- **Hors-ligne** : si le Wi-Fi coupe, l'élève continue. Les résultats s'envoient automatiquement au retour du réseau (indicateur ☁️ / ⏳ en haut à droite).

### Rôles : administrateur et enseignants
| | Administrateur (`admin`) | Enseignant |
|---|---|---|
| Résultats visibles | tous les groupes | **ses groupes seulement** |
| Créer / supprimer des groupes | tous | les siens |
| Comptes enseignants (ajouter, désactiver, nouveau NIP) | ✅ | ❌ |
| Réattribuer un groupe, gérer les résultats « orphelins » | ✅ | ❌ |
| Gérer les écoles (ajouter, renommer, désactiver) | ✅ | ❌ |
| Réinitialiser le NIP d'un élève | tous | ses élèves |
| Listes de verbes (communes à tous) | ✅ | ❌ |
| Export CSV, changer son NIP | ✅ | ✅ |

- L'administrateur crée les comptes dans l'onglet **🧑‍🏫 Enseignants** (nom, identifiant, NIP de départ) et transmet l'identifiant et le NIP.
- L'administrateur crée les **écoles** dans l'onglet **🏛️ Écoles** : un nom visible par les élèves et un code court (ex. `SJ`) qui ne change plus.
- Chaque enseignant crée ses groupes dans **🏫 Mes groupes** en choisissant l'école. Dans une même école, un numéro n'appartient qu'à un seul enseignant, mais deux écoles peuvent chacune avoir un groupe 21.
- Un élève qui entre un groupe qui n'existe pas est bloqué avec un message. Si personne n'a encore créé de groupe, tous les groupes sont acceptés.
- Le tri des données se fait dans le script Google : un enseignant ne reçoit jamais les résultats des autres groupes.
- Les NIP sont hachés (jamais en clair). Après 5 essais ratés, l'identifiant est bloqué 5 minutes. La session expire après 6 heures d'inactivité ou à la fermeture de l'onglet.

### Pour l'enseignant (identifiant + NIP)
- **👥 Élèves** : activités, moyenne, meilleur sprint, temps de pratique et verbes à revoir pour chaque élève. Filtres par groupe, bloc, activité et période.
- **🔥 Verbes difficiles** : taux d'erreur par verbe, avec une **carte de chaleur par groupe** pour cibler les mini-leçons.
- **Fiche élève** (clic sur un élève) : état du compte (NIP défini ou non), maîtrise par bloc, bouton **Réinitialiser le NIP**, graphique de progression et toutes les tentatives.
- **📚 Verbes et phrases** (administrateur) : modifie les 4 blocs (une ligne par verbe : `infinitif ; passé ; participe ; français`, variantes séparées par `/`). Tu peux aussi coller des colonnes copiées d'Excel. Les verbes sont enregistrés dans l'onglet « Verbes » de la feuille, où tu peux aussi les modifier directement. Le bouton **Copier les phrases par défaut dans la feuille** place les 300 phrases dans l'onglet « Phrases » pour les relire et les modifier. Colonnes : verbe · phrase avec `___` · réponse · forme (`P` passé simple, `PP` participe passé, `B` infinitif, `S` présent he/she/it) · indice (mot de la phrase qui révèle le temps).
- **🏫 Groupes** : création de groupes, effacement des résultats d'un groupe (le groupe est gardé) ou suppression complète d'un groupe, avec confirmation en deux clics.
- **⚙️ Mon compte** : export CSV et changement de son NIP.


---

## 🧠 Fondements pédagogiques
- **Pratique de récupération** (*retrieval practice*) : se tester plutôt que relire.
- **Répétition espacée** (boîtes de Leitner) : un verbe est « maîtrisé » après 3 bonnes réponses sans indice, à des moments différents.
- **Apprentissage par régularités** : 7 familles de verbes détectées automatiquement, même dans tes propres listes.
- **Rétroaction immédiate et explicative** : correction, famille du verbe, repère en contexte (« Yesterday, I went · I have gone ») et prononciation 🔊.
- **État d'esprit de croissance** : messages centrés sur le progrès, aucun classement public entre élèves.
- **Accessibilité** : navigation au clavier (Entrée passe au champ suivant), mode « Aa » de lecture facilitée, mode sombre, animations réduites si l'appareil le demande.

## ❓ Dépannage
| Problème | Solution |
|---|---|
| « 📴 Local » s'affiche | L'URL n'est pas configurée dans `js/config.js`. |
| « Aucun NIP administrateur » | Dans la feuille : menu *Verbes irréguliers › Définir ou changer le NIP administrateur*. |
| Un enseignant a oublié son NIP | L'administrateur clique sur **Nouveau NIP** dans l'onglet Enseignants. |
| L'administrateur a oublié son NIP | Dans la feuille : menu *Verbes irréguliers › Définir ou changer le NIP administrateur*. |
| « Ce groupe n'existe pas dans cette école » | L'enseignant doit d'abord créer ce groupe dans **Mes groupes**, dans la bonne école. |
| Un élève a oublié son NIP | Dans la fiche de l'élève : **Réinitialiser le NIP**. L'élève en choisit un nouveau, et sa progression est conservée. |
| « Ce code a déjà un NIP » à la première connexion | Un autre élève du groupe a les mêmes initiales : ajouter un chiffre (ex. AB2). |
| « Reconnecte-toi pour envoyer tes résultats » | La session de l'élève a expiré (après 180 jours ou une réinitialisation du NIP) : il se reconnecte avec son NIP, et les résultats en attente partent automatiquement. |
| Les résultats n'arrivent pas | Vérifie que le déploiement est bien « Qui a accès : **Tout le monde** » et que l'URL se termine par `/exec`. |
| Une modification de `Code.gs` ne s'applique pas | Publie une **nouvelle version** du déploiement (voir l'étape 1). |
| Pas de son 🔊 | La voix dépend du navigateur. Chrome et Edge ont des voix anglaises par défaut. |
