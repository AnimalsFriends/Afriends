/**
 * CONTROLADOR: página de inicio. Conecta modelo -> vistas de la home.
 * (El header, footer y WhatsApp flotante los maneja LayoutController;
 *  el cotizador y el formulario tienen sus propios controladores.)
 */
import { ServicesView } from "../views/ServicesView.js";
import { mount } from "../utils/dom.js";

export class HomeController {
  constructor({ servicesList }) {
    this.servicesList = servicesList;
  }

  render({ categorias, negocio }) {
    mount(this.servicesList, ServicesView.cards(categorias, negocio.moneda));
    this.servicesList.setAttribute("aria-busy", "false");
  }

  renderError() {
    mount(this.servicesList, '<li class="state-msg">No pudimos cargar los servicios. Escríbenos por WhatsApp y te ayudamos.</li>');
    this.servicesList.setAttribute("aria-busy", "false");
  }
}
