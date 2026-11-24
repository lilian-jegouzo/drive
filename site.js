/* DRIVE · affiche le contenu de contenu.js dans la page. Pas besoin de modifier ce fichier. */
(function(){
  var D = window.DRIVE || {};
  var L = D.liens || {};
  var $ = function(s){return document.querySelector(s);};
  var esc = function(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
  var mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var date = function(s){if(!s)return '';var p=s.split('-');return (+p[2])+' '+mois[+p[1]-1]+' '+p[0];};

  if(D.logo !== 'droit') document.body.classList.add('logo-vitesse');

  // Liens des réseaux : masqués tant qu'ils sont vides
  var urlDe = function(k, sujet){
    var v = L[k]; if(!v) return '';
    if(k==='email') return 'mailto:'+v+(sujet?'?subject='+encodeURIComponent(sujet):'');
    return v;
  };
  document.querySelectorAll('[data-lien]').forEach(function(a){
    var u = urlDe(a.dataset.lien, a.dataset.sujet);
    if(u){ a.href = u; if(a.dataset.lien!=='email'){a.target='_blank';a.rel='noopener';} }
    else if(a.dataset.lien==='email'){ a.hidden = true; }
    else if(a.classList.contains('lien-fleche')){ a.hidden = true; }
  });
  var noms = {youtube:'YouTube',tiktok:'TikTok',instagram:'Instagram',linkedin:'LinkedIn',email:'Contact'};
  var pied = $('#pied-liens');
  Object.keys(noms).forEach(function(k){
    var u = urlDe(k); if(!u) return;
    var a = document.createElement('a'); a.href = u; a.textContent = noms[k];
    if(k!=='email'){a.target='_blank';a.rel='noopener';}
    pied.appendChild(a);
  });
  $('#annee').textContent = new Date().getFullYear();

  // Épisodes
  var eps = D.episodes || [];
  var boite = $('#liste-episodes');
  if(!eps.length){
    boite.innerHTML = '<div class="bientot"><div class="bientot-titre">Premier épisode<br>en route.</div><div><p>Le tournage de la saison 1 commence. Abonnez-vous pour voir le premier épisode dès sa sortie.</p>'+
      (L.youtube ? '<a class="bouton bouton-noir" href="'+esc(L.youtube)+'" target="_blank" rel="noopener">S’abonner sur YouTube</a>' : '')+'</div></div>';
  } else {
    boite.innerHTML = eps.map(function(e){
      var url = e.youtube ? 'https://www.youtube.com/watch?v='+encodeURIComponent(e.youtube) : '#';
      var img = e.youtube ? '<img loading="lazy" src="https://i.ytimg.com/vi/'+encodeURIComponent(e.youtube)+'/hqdefault.jpg" alt="">' : '';
      return '<a class="ep" href="'+url+'" target="_blank" rel="noopener"><div class="ep-image">'+img+'</div>'+
        '<div class="ep-meta">Épisode '+esc(e.numero)+(e.date?' · '+date(e.date):'')+'</div>'+
        '<div class="ep-titre">'+esc(e.titre)+'</div>'+
        '<div class="ep-invite">'+esc(e.invite)+(e.role?', '+esc(e.role):'')+'</div></a>';
    }).join('');
  }

  // Articles
  var arts = D.articles || [];
  $('#liste-articles').innerHTML = arts.length ? arts.map(function(a){
    return '<a class="art" href="'+esc(a.lien)+'"><span class="art-date">'+date(a.date)+'</span>'+
      '<span><span class="art-titre">'+esc(a.titre)+'</span><span class="art-chapo" style="display:block">'+esc(a.chapo)+'</span></span>'+
      '<span class="art-fleche" aria-hidden="true">→</span></a>';
  }).join('') : '<p style="padding:28px 0;color:var(--gris)">Les premiers articles arrivent.</p>';

  // Équipe
  $('#liste-equipe').innerHTML = (D.equipe || []).map(function(m){
    return '<div class="membre"><div class="membre-nom">'+esc(m.nom)+'</div><div class="membre-role">'+esc(m.role)+'</div>'+
      '<p class="membre-bio">'+esc(m.bio)+'</p>'+(m.linkedin?'<a href="'+esc(m.linkedin)+'" target="_blank" rel="noopener">LinkedIn</a>':'')+'</div>';
  }).join('');
})();
