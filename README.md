# DRIVE · site web

Le site du podcast DRIVE : https://lilian-jegouzo.github.io/drive/

Site statique (HTML, CSS, JavaScript), sans outil à installer, hébergé gratuitement par GitHub Pages. Chaque modification enregistrée sur la branche `main` est en ligne en 1 à 2 minutes.

## Mettre le site à jour

Tout le contenu courant est dans **`contenu.js`** :

- ajouter un épisode (il suffit de l'identifiant de la vidéo YouTube, la miniature vient toute seule) ;
- ajouter un article ;
- renseigner les liens YouTube, TikTok, Instagram, LinkedIn et l'adresse de contact (un lien vide est masqué) ;
- modifier les biographies de l'équipe ;
- choisir le logo (`vitesse` ou `droit`) et la matière du DRIVE 3D (`chrome` ou `bicolore`).

Depuis le navigateur : ouvrir `contenu.js` sur GitHub, cliquer sur le crayon, modifier, puis « Commit changes ».

## Ajouter un article

1. Dupliquer `articles/qui-fait-quoi.html` sous un nouveau nom.
2. Remplacer le titre, la date et le texte.
3. Ajouter une ligne dans la liste `articles` de `contenu.js`.

## Fichiers

- `index.html` : la page d'accueil
- `style.css` : l'apparence
- `site.js` : affiche le contenu de `contenu.js`
- `hero3d.js` : le mot DRIVE en 3D (Three.js, police Archivo Expanded Black, penché à 12,4°)
- `assets/` : logo, favicon, image de partage, glyphes 3D, Three.js
