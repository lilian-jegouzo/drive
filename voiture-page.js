/* DRIVE · page voiture : textes de l'équipe et formulaire. La 3D est dans voiture.js. */
(function(){
  var D = window.DRIVE || {};
  if (D.logo !== 'droit') document.body.classList.add('logo-vitesse');

  // Fiches : nom, rôle et bio viennent de contenu.js
  document.querySelectorAll('[data-equipe]').forEach(function(el){
    var m = (D.equipe || [])[+el.dataset.equipe];
    if (m && m[el.dataset.champ]) el.textContent = m[el.dataset.champ];
  });

  // Formulaire : envoi par FormSubmit vers l'adresse de contact de contenu.js (liens.email)
  var form = document.getElementById('form-contact');
  if (!form) return;
  var etat = form.querySelector('.form-etat');
  var dire = function(t, classe){ etat.textContent = t; etat.className = 'form-etat ' + (classe || ''); };
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var ok = true;
    form.querySelectorAll('[required]').forEach(function(c){
      var bon = c.value.trim() !== '' && (c.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.value.trim()));
      c.setAttribute('aria-invalid', bon ? 'false' : 'true'); if (!bon) ok = false;
    });
    if (!ok){ dire('Merci de remplir votre nom, une adresse e-mail valide et votre message.', 'erreur'); return; }
    if (form._honey.value) return;
    var dest = (D.liens || {}).email;
    if (!dest){ dire('Le formulaire sera actif très bientôt. Merci de revenir dans quelques jours.', 'erreur'); return; }
    var donnees = new FormData(form);
    var corps = {};
    donnees.forEach(function(v, k){ if (k !== '_honey') corps[k] = v; });
    corps._subject = 'DRIVE · ' + corps.objet + ' · ' + corps.nom;
    corps._template = 'table';
    var bouton = form.querySelector('button'); bouton.disabled = true; dire('Envoi en cours…');
    fetch('https://formsubmit.co/ajax/' + encodeURIComponent(dest), {
      method:'POST', headers:{'Content-Type':'application/json', 'Accept':'application/json'}, body:JSON.stringify(corps)
    }).then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(){ form.reset(); dire('Merci ! Votre message est bien parti. On vous répond rapidement.', 'ok'); })
      .catch(function(){ dire('L’envoi n’a pas fonctionné. Réessayez dans un instant.', 'erreur'); })
      .then(function(){ bouton.disabled = false; });
  });
})();
