/* Pets cosméticos do perfil. */
var RPG=window.RPG||{};
RPG.Pets=(function(){
  var icons={chicken:'🐔',cat:'🐈',fox:'🦊',owl:'🦉',slime:'🟢'};
  var bonuses={
    chicken:{esquiva:3,label:'+3% de esquiva'},
    cat:{critico:3,label:'+3% de crítico'},
    fox:{esquiva:2,critico:2,label:'+2% de esquiva e crítico'},
    owl:{manaSave:5,label:'5% de chance de poupar mana'},
    slime:{healing:5,label:'+5% de cura recebida'}
  };
  function render(user){
    var widget=document.getElementById('profilePetWidget');
    if(!widget)return;
    var pet=user&&user.pet||'none';
    widget.classList.toggle('hidden',pet==='none'||!icons[pet]);
    if(icons[pet])document.getElementById('profilePetIcon').textContent=icons[pet];
  }
  function love(){
    var widget=document.getElementById('profilePetWidget');
    if(!widget||widget.classList.contains('hidden'))return;
    var heart=document.createElement('span');
    heart.className='pet-heart';heart.textContent='❤';heart.style.color='#ff6b8a';
    widget.appendChild(heart);
    requestAnimationFrame(function(){heart.style.transform='translateY(-48px) scale(1.4)';heart.style.opacity='0';});
    setTimeout(function(){heart.remove();},850);
    if(RPG.Effects&&RPG.Effects.playSfx)RPG.Effects.playSfx('heal');
  }
  document.addEventListener('DOMContentLoaded',function(){var widget=document.getElementById('profilePetWidget');if(widget)widget.addEventListener('click',love);});
  function bonus(){var user=RPG.Account&&RPG.Account.currentUser?RPG.Account.currentUser():null;return bonuses[user&&user.pet]||{};}
  function icon(pet){return icons[pet]||'🐾';}
  return {render:render,love:love,bonus:bonus,icon:icon};
})();
