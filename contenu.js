/* ============================================================
   CONTENU DU SITE DRIVE
   C'est le seul fichier à modifier pour mettre le site à jour.
   Après chaque modification : enregistrer → le site se met à jour
   tout seul en 1 à 2 minutes.
   ============================================================ */

window.DRIVE = {

  /* Logo : 'vitesse' (D penché) ou 'droit' (D droit) */
  logo: 'vitesse',

  /* Matière du DRIVE 3D en haut de page : 'chrome' ou 'bicolore' (chrome et noir) */
  matiere: 'chrome',

  /* Liens des réseaux. Laisser '' tant que le compte n'existe pas : le lien est alors masqué. */
  liens: {
    youtube:   '',
    tiktok:    '',
    instagram: '',
    linkedin:  '',
    email:     ''   /* ex. 'contact@drive-podcast.fr' */
  },

  /* ÉPISODES : copier un bloc { ... }, le plus récent en premier.
     youtube = l'identifiant de la vidéo, c'est-à-dire ce qui suit "v=" dans le lien
     (https://www.youtube.com/watch?v=AbCdEf12345 → 'AbCdEf12345').
     La miniature est récupérée automatiquement. */
  episodes: [
    /*
    {
      numero: 1,
      invite: 'Prénom Nom',
      role: 'Trader actions, banque X',
      titre: 'Le titre de l’épisode',
      date: '2027-01-27',
      youtube: 'AbCdEf12345',
      resume: 'Deux phrases sur ce qu’on apprend dans l’épisode.'
    },
    */
  ],

  /* ARTICLES : chaque article est une page dans le dossier articles/.
     Pour en ajouter un : dupliquer articles/qui-fait-quoi.html, changer le texte,
     puis ajouter une ligne ici. */
  articles: [
    {
      titre: 'Sales, trading, structuration : qui fait quoi en salle de marché',
      date: '2026-11-24',
      lien: 'articles/qui-fait-quoi.html',
      chapo: 'Les trois métiers du front office, expliqués simplement, avant nos premiers épisodes.'
    }
  ],

  /* L'ÉQUIPE */
  equipe: [
    {
      nom: 'Lilian Jégouzo',
      role: 'Co-fondateur · au volant',
      bio: 'Étudiant à ESCP Business School. Se destine à la structuration.',
      linkedin: ''
    },
    {
      nom: 'Raphaël Chouraqui',
      role: 'Co-fondateur · à l’interview',
      bio: 'Étudiant à ESCP Business School. Se destine au trading.',
      linkedin: ''
    }
  ]
};
