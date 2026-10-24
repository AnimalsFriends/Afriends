/**
 * Acceso REST de la agenda. La escritura de cita y asignaciones es atómica vía RPC.
 */
import { inicioDiaBogotaUTC } from "../models/agendaModel.js";
import { esUuid, esFechaISO } from "../models/gestionModel.js";
import { llamar } from "./gestionApi.js";
import { RutasApi } from "./rutasApi.js";
import { ApiError } from "./adminApi.js";
const JSON_HEADERS={"Content-Type":"application/json"},REPRESENTACION={...JSON_HEADERS,Prefer:"return=representation"};
const uuid=v=>{if(!esUuid(v))throw new ApiError("fail");return v;};
async function listaCompleta(path){const filas=[];for(let offset=0;;offset+=1000){const pagina=await llamar(`${path}${path.includes("?")?"&":"?"}limit=1000&offset=${offset}`);filas.push(...pagina);if(pagina.length<1000)return filas;}}
const primeraFila=async p=>{const value=await p;return Array.isArray(value)?value[0]??null:value??null;};
const escribir=(method,path,body)=>llamar(path,{method,headers:REPRESENTACION,body:JSON.stringify(body)});
const normalizarCita=c=>({...c,empleado_ids:[...new Set([...(c.cita_empleados??[]).map(x=>x.empleado_id),c.empleado_id].filter(Boolean))]});
export const AgendaApi={
 async cargar({fecha,rango}){
  const mes=fecha.slice(0,7),[year,month]=mes.split("-").map(Number),inicioMes=`${mes}-01`,finMes=new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);
  const desde=inicioDiaBogotaUTC(rango.inicio),hasta=inicioDiaBogotaUTC(rango.fin);if(!desde||!hasta)throw new ApiError("fail");
  const filtro=`or=(and(inicio.lt.${hasta},fin.gt.${desde}),and(inicio.is.null,fecha_servicio.gte.${rango.inicio},fecha_servicio.lt.${rango.fin}))`;
  const [operacion,citas,reservas,servicios]=await Promise.all([
   RutasApi.cargar({fecha,inicioMes,finMes}),
   listaCompleta(`citas?select=*,cita_empleados(empleado_id)&${filtro}&order=fecha_servicio.asc,inicio.asc.nullslast,id.asc`),
   RutasApi.reservasEntre(rango.inicio,rango.fin),
   listaCompleta("servicios?select=codigo,nombre,activo,orden&activo=eq.true&order=orden.asc,codigo.asc")
  ]);
  return {...operacion,citas:citas.map(normalizarCita),reservas,servicios};
 },
 citasSolapadas(inicio,fin){
  if(!inicio||!fin)return Promise.resolve([]);
  if(!Number.isFinite(Date.parse(inicio))||!Number.isFinite(Date.parse(fin))||Date.parse(fin)<=Date.parse(inicio))throw new ApiError("fail");
  return listaCompleta(`citas?select=*,cita_empleados(empleado_id)&inicio=lt.${encodeURIComponent(fin)}&fin=gt.${encodeURIComponent(inicio)}&order=inicio.asc,id.asc`).then(rows=>rows.map(normalizarCita));
 },
 guardarCita(datos,id=null){
  const ids=[...new Set((datos.empleado_ids??[]).map(uuid))];
  if(!ids.length)throw new ApiError("fail");
  const body={p_id:id?uuid(id):null,p_mascota_id:uuid(datos.mascota_id),p_empleado_ids:ids,p_servicio_codigo:datos.servicio_codigo,p_fecha_servicio:datos.fecha_servicio,p_inicio:datos.inicio,p_fin:datos.fin,p_estado:datos.estado,p_notas:datos.notas};
  return primeraFila(escribir("POST","rpc/guardar_cita_agenda",body));
 },
 crearCita(datos){return this.guardarCita(datos);},
 actualizarCita(id,datos){return this.guardarCita(datos,id);},
 actualizarEstado(id,estado){return primeraFila(escribir("PATCH",`citas?id=eq.${uuid(id)}`,{estado}));}
};
