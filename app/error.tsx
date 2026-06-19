'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Route-level error boundary — zachytí neočekávané chyby v aplikaci a místo pádu
 * zobrazí srozumitelnou hlášku s možností akci zopakovat.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Neočekávaná chyba aplikace:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-8">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-600" />
        <h2 className="text-lg font-bold text-red-900">Něco se pokazilo</h2>
        <p className="mt-2 text-sm text-red-700">
          V aplikaci nastala neočekávaná chyba. Zkuste akci zopakovat. Pokud potíže přetrvávají,
          obnovte stránku nebo to zkuste za chvíli.
        </p>
        {error?.digest && (
          <p className="mt-2 text-[11px] text-red-400">Kód chyby: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-600"
        >
          <RotateCcw className="h-4 w-4 text-accent" />
          Zkusit znovu
        </button>
      </div>
    </div>
  );
}
