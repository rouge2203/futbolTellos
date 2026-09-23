import { GiWhistle } from "react-icons/gi";
import { TbPlayFootball } from "react-icons/tb";

interface Props {
  arbitro: boolean;
  esReto: boolean;
  onRefereeChange: (value: boolean) => void;
  onRetoChange: (value: boolean) => void;
  editing?: boolean;
}

export default function ReservaFijaOptions({ arbitro, esReto, onRefereeChange, onRetoChange, editing = false }: Props) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-900">En cada reservación</legend>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={arbitro} onChange={(e) => onRefereeChange(e.target.checked)} className="mt-1 size-4 shrink-0 accent-primary" />
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-900"><GiWhistle className="text-primary text-lg" />Siempre con árbitro</span>
            <span className="mt-1 block text-xs leading-5 text-gray-600">+ ₡5,000 por reservación. {editing ? "Se aplica a las próximas y a las que se generen después." : "Incluido también en las nuevas reservaciones automáticas."}</span>
          </span>
        </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={esReto} onChange={(e) => onRetoChange(e.target.checked)} className="mt-1 size-4 shrink-0 accent-primary" />
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-900"><TbPlayFootball className="text-primary text-lg" />Siempre crear un reto</span>
          <span className="mt-1 block text-xs leading-5 text-gray-600">Cada fecha tendrá su propio reto abierto, con el titular como Equipo 1.{editing && " Al activarlo se crean también los retos de las próximas reservaciones. Desactivarlo conserva los retos existentes."}</span>
        </span>
      </label>
    </fieldset>
  );
}
