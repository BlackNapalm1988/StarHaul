export function ensureOffersForPlanet(state, planet){
  while(planet.offers.length < CFG.contracts.perPlanet){
    let to;
    do{
      to = state.planets[Math.floor(Math.random()*state.planets.length)];
    } while(!to || to.id === planet.id);
    planet.offers.push({
      id: Math.random().toString(36).slice(2),
      from: planet.id,
      to: to.id,
      qty: 3,
      reward: 100,
      timeLeft: CFG.contracts.maxTime
    });
  }
}

export function refreshOffers(state){
  state.planets.forEach(p => {
    p.offers = p.offers.filter(o => o.timeLeft>0);
    ensureOffersForPlanet(state, p);
  });
}
