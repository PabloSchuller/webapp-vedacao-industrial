export const SESSION_EXPIRED='vedacao:session-expired';
export function createApiClient({baseURL='',fetcher=(...args)=>fetch(...args),onUnauthorized=()=>{}}={}){
  async function fetchApi(path,{token,method='GET',body,signal}={}){
    let response;
    try{
      response=await fetcher(baseURL+path,{method,signal,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    }catch(error){
      if(error.name==='AbortError')throw error;
      throw new Error('A API está indisponível. Verifique sua conexão e tente novamente.');
    }
    if(response.status===401&&token)onUnauthorized(token);
    return response;
  }
  async function request(path,options){
    const response=await fetchApi(path,options);
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Object.assign(new Error(data.erro||data.detail||`Erro ${response.status}`),{status:response.status, detalhes:data.detalhes});
    return data;
  }
  return {fetchApi,request};
}
const client=createApiClient({baseURL:import.meta.env?.VITE_API_URL||'http://localhost:3001',onUnauthorized:token=>window.dispatchEvent(new CustomEvent(SESSION_EXPIRED,{detail:{token}}))});
export const {fetchApi,request}=client;
