export function coordinates(latitude,longitude){
  if([latitude,longitude].some(v=>v==null||String(v).trim()===''))return null;
  const lat=Number(latitude),lng=Number(longitude);
  return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null;
}
export function locationURL(g){
  const p=coordinates(g.latitude,g.longitude);
  return p?`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${p.lat},${p.lng}`:`https://www.openstreetmap.org/search?query=${encodeURIComponent(g.endereco||'')}`;
}
