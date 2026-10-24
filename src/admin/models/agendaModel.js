/**
 * Reglas puras para agenda y planeación. La agenda usa la zona de Bogotá.
 */
import { esFechaISO, esUuid } from "./gestionModel.js";
import { servicioMascotaEnFecha } from "./rutasModel.js";

export const VISTAS_AGENDA = [["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]];
export const ESTADOS_CITA = [["pendiente", "Pendiente"], ["en_curso", "En curso"], ["listo", "Listo"], ["cancelado", "Cancelado"]];
export const fechaMas = (fecha, dias) => { const [y,m,d]=fecha.split("-").map(Number); return new Date(Date.UTC(y,m-1,d+dias)).toISOString().slice(0,10); };
const primerDiaSemana = (fecha) => { const dia=new Date(`${fecha}T00:00:00Z`).getUTCDay(); return fechaMas(fecha,-((dia+6)%7)); };
export function rangoAgenda(fecha,vista) {
  if(!esFechaISO(fecha)) return null;
  if(vista==="dia") return {inicio:fecha,fin:fechaMas(fecha,1)};
  if(vista==="semana"){const inicio=primerDiaSemana(fecha);return {inicio,fin:fechaMas(inicio,7)};}
  if(vista==="mes"){const inicio=`${fecha.slice(0,7)}-01`;const [y,m]=fecha.slice(0,7).split("-").map(Number);return {inicio,fin:new Date(Date.UTC(y,m,1)).toISOString().slice(0,10)};}
  return null;
}
export function diasEntre(inicio,fin){const dias=[];for(let d=inicio;d<fin;d=fechaMas(d,1))dias.push(d);return dias;}
export function inicioDiaBogotaUTC(fecha){return esFechaISO(fecha)?`${fecha}T05:00:00.000Z`:null;}
export function fechaHoraBogotaAUTC(valor){
 const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}):([0-5]\d)$/.exec(String(valor??""));
 if(!m||!esFechaISO(m[1])||Number(m[2])>23)return null;
 const d=new Date(`${valor}:00-05:00`);return Number.isNaN(d.getTime())?null:d.toISOString();
}
function parteFechaBogota(valor,parte){const d=new Date(valor);if(Number.isNaN(d.getTime()))return "";return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).find(p=>p.type===parte)?.value??"";}
export function fechaBogotaDeISO(valor){const [y,m,d]=["year","month","day"].map(p=>parteFechaBogota(valor,p));return y&&m&&d?`${y}-${m}-${d}`:"";}
export function fechaHoraBogotaDeISO(valor){if(!valor)return "";const fecha=fechaBogotaDeISO(valor);const [h,m]=["hour","minute"].map(p=>parteFechaBogota(valor,p));return fecha&&h&&m?`${fecha}T${h}:${m}`:"";}
const empleadosDe = (cita) => {
 const lista = cita.empleado_ids ?? cita.empleados_ids ?? cita.cita_empleados?.map(x=>x.empleado_id) ?? [];
 return [...new Set([...(Array.isArray(lista)?lista:[]),cita.empleado_id].filter(esUuid))];
};
export function validarCita(form){
 const fecha=String(form.fecha_servicio??form.fecha??"").trim();
 const tieneInicio=String(form.inicio??"").trim()!=="", tieneFin=String(form.fin??"").trim()!=="";
 const inicio=tieneInicio?fechaHoraBogotaAUTC(form.inicio):null, fin=tieneFin?fechaHoraBogotaAUTC(form.fin):null;
 const servicio=String(form.servicio_codigo??"").trim(),notas=String(form.notas??"").trim(),estado=String(form.estado??"pendiente");
 const empleadoIds=empleadosDe(form),errors=[];
 if(!esUuid(form.mascota_id))errors.push("Elige un perro.");
 if(!empleadoIds.length)errors.push("Asigna al menos un empleado.");
 if(!/^[a-z0-9_]{2,30}$/.test(servicio))errors.push("Elige un servicio válido.");
 if(!esFechaISO(fecha))errors.push("Indica la fecha del servicio.");
 if(tieneInicio!==tieneFin)errors.push("Completa las dos horas o déjalas ambas vacías.");
 if(tieneInicio&&!inicio)errors.push("Indica una hora de inicio válida.");
 if(tieneFin&&!fin)errors.push("Indica una hora de fin válida.");
 if(inicio&&fin&&fin<=inicio)errors.push("La hora de fin debe ser posterior al inicio.");
 if(!ESTADOS_CITA.some(([v])=>v===estado))errors.push("El estado de la cita no es válido.");
 if(notas.length>1000)errors.push("Las notas no pueden superar 1000 caracteres.");
 return {errors,clean:{mascota_id:form.mascota_id,empleado_ids:empleadoIds,servicio_codigo:servicio,fecha_servicio:fecha,inicio,fin,estado,notas:notas||null}};
}
const servicioColectivo=(codigo)=>["hotel","colegio","hotel_colegio"].includes(String(codigo??"").toLowerCase());
export function conflictosCita(cita,citas){
 if(cita.estado==="cancelado"||!cita.inicio||!cita.fin)return [];
 const inicio=Date.parse(cita.inicio),fin=Date.parse(cita.fin);
 if(!Number.isFinite(inicio)||!Number.isFinite(fin)||fin<=inicio)return [];
 const empleados=empleadosDe(cita);
 return citas.flatMap(otra=>{
  if(otra.id===cita.id||otra.estado==="cancelado"||!otra.inicio||!otra.fin)return [];
  const oi=Date.parse(otra.inicio),of=Date.parse(otra.fin);
  if(!Number.isFinite(oi)||!Number.isFinite(of)||inicio>=of||fin<=oi)return [];
  const tipos=[];
  const otros=empleadosDe(otra);
  if(!servicioColectivo(cita.servicio_codigo)&&!servicioColectivo(otra.servicio_codigo)&&empleados.some(id=>otros.includes(id)))tipos.push("empleado");
  if(cita.mascota_id===otra.mascota_id)tipos.push("mascota");
  return tipos.length?[{cita:otra,tipos}]:[];
 });
}
export function planificarRutas(fecha,rutas,paradas,mascotas,planes,reservas,ausencias){
 const activas=rutas.filter(r=>r.activa),perrosPorRuta=new Map(activas.map(r=>[r.id,new Set()])),rutasPorPerro=new Map();
 const programados=new Set(mascotas.filter(m=>!m.es_mascota_propia&&["colegio","hotel_colegio"].includes(servicioMascotaEnFecha(m,fecha,planes,reservas,ausencias).codigo)).map(m=>m.id));
 for(const p of paradas){if(!p.activa||p.sentido!=="recogida"||!perrosPorRuta.has(p.ruta_id)||!programados.has(p.mascota_id))continue;perrosPorRuta.get(p.ruta_id).add(p.mascota_id);if(!rutasPorPerro.has(p.mascota_id))rutasPorPerro.set(p.mascota_id,new Set());rutasPorPerro.get(p.mascota_id).add(p.ruta_id);}
 const detalle=activas.map(r=>{const perros=perrosPorRuta.get(r.id).size,capacidad=Number.isInteger(r.capacidad_perros)&&r.capacidad_perros>0?r.capacidad_perros:null,necesarios=perros===0?0:capacidad?Math.ceil(perros/capacidad):null,asignados=perros>0&&r.empleado_id?1:0;return {ruta:r,perros,capacidad,necesarios,asignados,faltantes:necesarios===null?null:Math.max(0,necesarios-asignados)};});
 const perrosSinRuta=[...programados].filter(id=>!rutasPorPerro.has(id)),sinCapacidad=perrosSinRuta.length>0||detalle.some(r=>r.perros>0&&r.capacidad===null);
 return {totalPerros:programados.size,totalEmpleados:sinCapacidad?null:detalle.reduce((t,r)=>t+r.necesarios,0),empleadosAsignados:detalle.reduce((t,r)=>t+r.asignados,0),empleadosFaltantes:sinCapacidad?null:detalle.reduce((t,r)=>t+r.faltantes,0),perrosSinRuta,perrosEnVariasRutas:[...rutasPorPerro.entries()].filter(([,ids])=>ids.size>1).map(([id])=>id),rutas:detalle};
}
