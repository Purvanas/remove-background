# Remove Background

Une interface web simple pour détourer une image avec le modèle open source `rembg`, puis télécharger le résultat en PNG transparent.

**Démo : [bg.purvanas.fr](https://bg.purvanas.fr)**

Le navigateur envoie l’image au serveur, qui lance `rembg` dans un processus isolé et renvoie le PNG produit. Le service borne le poids des entrées, le nombre de traitements simultanés et la durée d’un processus. Les fichiers intermédiaires utilisent des noms aléatoires et sont supprimés à la fin du traitement, en cas d’échec ou si le client interrompt la requête.

## Points techniques

- validation de la signature binaire des formats JPEG, PNG, WebP, GIF, BMP et TIFF ;
- moteur `rembg` configurable via l’environnement, sans chemin propre à une machine ;
- une tâche simultanée par défaut pour protéger un petit serveur ;
- arrêt du processus si le délai est dépassé ou si le client se déconnecte ;
- journaux techniques conservés hors du dépôt et route de lecture masquée sans jeton d’exploitation.

## Installation

Prérequis : Node.js 22+, Python 3 et [`rembg`](https://github.com/danielgatis/rembg). Selon l’installation choisie, le premier traitement peut télécharger un modèle et prendre sensiblement plus de temps.

```bash
cp .env.example .env
npm ci
npm start
```

Les variables ne sont pas chargées automatiquement depuis `.env` : configure-les dans le shell ou le gestionnaire de processus. Par défaut, l’application écoute sur `127.0.0.1:4100` pour être publiée derrière un reverse proxy. Les dossiers temporaires et de journaux peuvent être séparés du code avec `REMBG_TMP_DIR` et `REMBG_RUNTIME_DIR`.

## Périmètre et confidentialité

Les images sont traitées temporairement sur le serveur : ce traitement n’est pas réalisé dans le navigateur et ne fournit pas de chiffrement de bout en bout. Le dépôt public exclut les images, journaux, identifiants d’analytics, paramètres publicitaires et configuration de production.

La qualité du détourage dépend du modèle utilisé par `rembg`, du sujet et de l’image d’origine. Ce service personnel ne fournit pas de garantie de disponibilité.

## Licence

Le code de cette interface est distribué sous licence MIT. `rembg` et ses modèles conservent leurs propres licences et conditions d’utilisation.
