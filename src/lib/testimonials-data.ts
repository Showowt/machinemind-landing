export interface Testimonial {
  id: string;
  clientName: string;
  clientTitle: string;
  company: string;
  quoteEs: string;
  quoteEn: string;
  highlightPhrase: string;
  metric?: {
    value: string;
    labelEs: string;
    labelEn: string;
  };
}

export const testimonials: Testimonial[] = [
  {
    id: "1",
    clientName: "María González",
    clientTitle: "Directora de Operaciones",
    company: "Hotel Boutique Cartagena",
    quoteEs:
      "MachineMind transformó completamente nuestra operación. El chatbot de WhatsApp maneja el 80% de las consultas automáticamente, y nuestro equipo ahora puede enfocarse en brindar experiencias excepcionales.",
    quoteEn:
      "MachineMind completely transformed our operation. The WhatsApp chatbot handles 80% of inquiries automatically, and our team can now focus on delivering exceptional experiences.",
    highlightPhrase: "80% de las consultas automáticamente",
    metric: {
      value: "+47%",
      labelEs: "aumento en reservas",
      labelEn: "increase in bookings",
    },
  },
  {
    id: "2",
    clientName: "Carlos Mendoza",
    clientTitle: "CEO",
    company: "Grupo Gastronómico Premium",
    quoteEs:
      "Implementamos el sistema de reservas de MachineMind en 3 de nuestros restaurantes. La integración con Wompi y el seguimiento automático han reducido los no-shows en un 60%.",
    quoteEn:
      "We implemented MachineMind's reservation system in 3 of our restaurants. The Wompi integration and automatic follow-ups have reduced no-shows by 60%.",
    highlightPhrase: "reducido los no-shows en un 60%",
    metric: {
      value: "-60%",
      labelEs: "reducción no-shows",
      labelEn: "reduction in no-shows",
    },
  },
  {
    id: "3",
    clientName: "Roberto Alvarez",
    clientTitle: "Director de Tecnología",
    company: "Tours Exclusivos Colombia",
    quoteEs:
      "La velocidad de desarrollo es impresionante. En solo 6 semanas teníamos una plataforma completa de reservas multilenguaje que supera cualquier solución que habíamos probado antes.",
    quoteEn:
      "The development speed is impressive. In just 6 weeks we had a complete multilingual booking platform that surpasses any solution we had tried before.",
    highlightPhrase: "En solo 6 semanas",
    metric: {
      value: "6",
      labelEs: "semanas a producción",
      labelEn: "weeks to production",
    },
  },
  {
    id: "4",
    clientName: "Ana Patricia Ruiz",
    clientTitle: "Fundadora",
    company: "Concierge VIP Medellín",
    quoteEs:
      "Lo que más me impresiona es que el sistema realmente se mantiene solo. Las actualizaciones automáticas, el monitoreo 24/7, y el soporte bilingüe han eliminado mis preocupaciones tecnológicas.",
    quoteEn:
      "What impresses me most is that the system truly maintains itself. Automatic updates, 24/7 monitoring, and bilingual support have eliminated my technology concerns.",
    highlightPhrase: "el sistema realmente se mantiene solo",
    metric: {
      value: "99.9%",
      labelEs: "uptime garantizado",
      labelEn: "guaranteed uptime",
    },
  },
];
