import type { Metadata } from 'next';
import VerificarClient from './verificar-client';

export const metadata: Metadata = {
  title: 'Verificación Oficial — MachineMind',
  description:
    'Verificá que quien te escribió es realmente MachineMind. Números oficiales de WhatsApp, compromiso anti-estafa y cómo confirmar que somos nosotros.',
  openGraph: {
    title: 'Verificación Oficial — MachineMind',
    description:
      'Números oficiales de WhatsApp de MachineMind y nuestro compromiso: nunca pedimos dinero por adelantado.',
  },
};

export default function VerificarPage() {
  return <VerificarClient />;
}
