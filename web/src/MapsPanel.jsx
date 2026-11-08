import React,{useEffect,useState} from 'react';
import {MapContainer,TileLayer,Marker,Popup,useMap} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import {coordinates,locationURL} from './location';
export const markerIcon=L.icon({iconUrl,iconRetinaUrl,shadowUrl,iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34],shadowSize:[41,41]});
export function MapTiles(){
  const [failed,setFailed]=useState(false);
  return <><TileLayer url={import.meta.env.VITE_OSM_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} maxZoom={19} attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'} eventHandlers={{tileerror:()=>setFailed(true),loading:()=>setFailed(false)}}/>{failed&&<div className="map-tile-error" role="alert">O mapa está indisponível ou a conexão falhou. Tente novamente mais tarde. O ponto selecionado foi preservado.</div>}</>;
}
function Bounds({points}){
  const map=useMap();const key=JSON.stringify(points);
  useEffect(()=>{if(points.length===1)map.setView(points[0],16);else if(points.length>1)map.fitBounds(points,{padding:[30,30],maxZoom:16});},[map,key]);
  return null;
}
export default function MapsPanel({galpoes,height=300}){
  const located=galpoes.filter(g=>coordinates(g.latitude,g.longitude));
  if(!located.length)return <div className="map-fallback" style={{minHeight:height}}><strong>Nenhuma localização marcada.</strong><span>Edite o galpão e selecione sua entrada no mapa.</span>{galpoes.map(g=><a key={g.id} href={locationURL(g)} target="_blank" rel="noreferrer">Buscar endereço de {g.nome}</a>)}</div>;
  const points=located.map(g=>[g.latitude,g.longitude]);
  return <MapContainer className="osm-map" style={{height}} center={points[0]} zoom={16} scrollWheelZoom={false}><MapTiles/><Bounds points={points}/>{located.map(g=><Marker key={g.id} position={[g.latitude,g.longitude]} icon={markerIcon}><Popup><strong>{g.nome}</strong><br/><a href={locationURL(g)} target="_blank" rel="noreferrer">Abrir rota</a></Popup></Marker>)}</MapContainer>;
}
