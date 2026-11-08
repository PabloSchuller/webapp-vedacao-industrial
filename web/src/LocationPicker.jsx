import React,{useEffect,useRef,useState} from 'react';
import {MapContainer,Marker,useMapEvents} from 'react-leaflet';
import {MapPin,Search,LocateFixed,AlertCircle,ExternalLink} from 'lucide-react';
import {MapTiles,markerIcon} from './MapsPanel';
import {coordinates,locationURL} from './location';
import {fetchApi} from './apiClient';
function Selection({point,onSelect}){
  const map=useMapEvents({click:e=>onSelect(e.latlng)});
  useEffect(()=>{if(point)map.setView(point,Math.max(map.getZoom(),16));},[map,point?.lat,point?.lng]);
  return point?<Marker position={point} icon={markerIcon} draggable eventHandlers={{dragend:e=>onSelect(e.target.getLatLng())}} title="Localização do galpão"/>:null;
}
export default function LocationPicker({token,endereco,latitude,longitude,onSelect,onAddressSuggestion}){
  const [error,setError]=useState(''),[working,setWorking]=useState(false),[suggestion,setSuggestion]=useState('');
  const generation=useRef(0),abort=useRef(null);
  useEffect(()=>()=>{generation.current++;abort.current?.abort();},[]);
  const point=coordinates(latitude,longitude);
  function select(p){
    generation.current++;abort.current?.abort();setWorking(false);setError('');setSuggestion('');
    onSelect({latitude:p.lat.toFixed(7),longitude:p.lng.toFixed(7)});
  }
  async function search(){
    if((endereco||'').trim().length<8){setError('Informe um endereço com cidade e estado.');return;}
    const version=++generation.current;abort.current?.abort();abort.current=new AbortController();
    setWorking(true);setError('');setSuggestion('');
    try{
      const r=await fetchApi(`/geo/geocodificar?endereco=${encodeURIComponent(endereco.trim())}`,{token,signal:abort.current.signal});
      const data=await r.json();if(version!==generation.current)return;
      if(!r.ok)throw new Error(data.erro||'Busca de endereços indisponível.');
      const p=coordinates(data.latitude,data.longitude);if(!p)throw new Error('O serviço retornou uma localização inválida.');
      onSelect({latitude:p.lat.toFixed(7),longitude:p.lng.toFixed(7)});setSuggestion(data.enderecoFormatado);
    }catch(e){if(version===generation.current)setError(e.name==='TypeError'?'Falha de conexão com a busca de endereços. Tente novamente.':e.message);}
    finally{if(version===generation.current)setWorking(false);}
  }
  function locate(){
    if(!navigator.geolocation){setError('Este navegador não permite acessar a localização.');return;}
    const version=++generation.current;abort.current?.abort();setWorking(true);setError('');
    navigator.geolocation.getCurrentPosition(p=>{if(version===generation.current)select({lat:p.coords.latitude,lng:p.coords.longitude});},()=>{if(version===generation.current){setWorking(false);setError('Localização indisponível ou permissão negada. Use a busca ou clique no mapa.');}},{enableHighAccuracy:true,timeout:12000});
  }
  return <div className="location-picker">
    <div className="picker-controls"><button type="button" className="btn outline" onClick={search} disabled={working||!endereco?.trim()}><Search size={16}/>{working?'Buscando…':'Buscar endereço no mapa'}</button><button type="button" className="btn outline" onClick={locate} disabled={working}><LocateFixed size={16}/>Usar minha localização</button></div>
    <MapContainer className="picker-map osm-map" center={point||[-26.485,-49.066]} zoom={point?16:12} scrollWheelZoom={false} aria-label="Mapa para selecionar a localização do galpão"><MapTiles/><Selection point={point} onSelect={select}/></MapContainer>
    <p className="picker-hint"><MapPin size={16}/>Clique no ponto exato da entrada do galpão ou arraste o marcador para ajustar.</p>
    {point&&<p className="picker-selected">Ponto selecionado: <strong>{point.lat.toFixed(7)}, {point.lng.toFixed(7)}</strong> <a href={locationURL({latitude:point.lat,longitude:point.lng})} target="_blank" rel="noreferrer">Abrir rota <ExternalLink size={13}/></a></p>}
    {suggestion&&<div className="picker-suggestion"><span>Endereço sugerido: <strong>{suggestion}</strong></span><button type="button" className="btn outline" onClick={()=>onAddressSuggestion?.(suggestion)}>Usar este endereço</button></div>}
    {error&&<div className="picker-error" role="alert"><AlertCircle size={16}/>{error}</div>}
    <p className="micro-note">As coordenadas são preenchidas automaticamente e gravadas ao salvar o galpão. A busca envia apenas o endereço ao OpenStreetMap/Nominatim; não inclua dados pessoais ou confidenciais.</p>
  </div>;
}
