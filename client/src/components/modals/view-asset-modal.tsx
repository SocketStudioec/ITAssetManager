import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

//Nuevos imports para el codigo qr
//import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

interface ViewAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: any;
}

export default function ViewAssetModal({ open, onOpenChange, asset }: ViewAssetModalProps) {
  if (!asset) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500 text-white">Activo</Badge>;
      case "maintenance": return <Badge className="bg-yellow-500 text-white">Mantenimiento</Badge>;
      case "inactive": return <Badge variant="secondary">Inactivo</Badge>;
      case "deprecated": return <Badge className="bg-orange-500 text-white">Obsoleto</Badge>;
      case "disposed": return <Badge className="bg-red-500 text-white">Desechado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const Field = ({ label, value, alert = false }: { label: string; value: any; alert?: boolean }) => {
    if (!value && value !== 0) return null;
    return (
      <div className="flex flex-col space-y-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-sm font-medium ${alert ? "text-destructive" : "text-foreground"}`}>
          {value}
        </span>
      </div>
    );
  };

  const isExpired = (date: string) => date && new Date(date) < new Date();
  const isExpiringSoon = (date: string) => {
    if (!date) return false;
    const d = new Date(date);
    return d >= new Date() && d <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span>{asset.name}</span>
            {getStatusBadge(asset.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">

          {/* Info General */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Información General
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo" value={asset.type === "physical" ? "Equipo Físico" : asset.type === "application" ? "Aplicación" : asset.type} />
              <Field label="Descripción" value={asset.description} />

              {/* Campos solo para físicos */}
              {asset.type === "physical" && (
                <>
                  <Field label="Fabricante" value={asset.manufacturer} />
                  <Field label="Modelo" value={asset.model} />
                  <Field label="Número de Serie" value={asset.serial_number} />
                  <Field label="Ubicación" value={asset.location} />
                </>
              )}

              {/* Campos solo para aplicaciones */}
              {asset.type === "application" && (
                <>
                  <Field label="Tipo de App" value={asset.application_type === "saas" ? "SaaS" : "Desarrollo Propio"} />
                  <Field label="Versión" value={asset.version} />
                  <Field label="URL" value={asset.url} />
                </>
              )}
            </div>
          </div>

          {/* Fechas - solo físicos */}
          {asset.type === "physical" && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Fechas
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Fecha de Compra"
                  value={asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : null}
                />
                <Field
                  label="Vencimiento de Garantía"
                  value={asset.warranty_expiry ? new Date(asset.warranty_expiry).toLocaleDateString() : null}
                  alert={isExpired(asset.warranty_expiry)}
                />
              </div>
            </div>
          )}

          {/* Fechas infraestructura - solo aplicaciones */}
          {asset.type === "application" && (
            <div>

              <div className="grid grid-cols-2 gap-4">
                {Number(asset.domain_cost) > 0 && (
                  <>
                    <Field label="Costo Dominio" value={`$${Number(asset.domain_cost).toLocaleString()}`} />
                    <Field
                      label="Vence Dominio"
                      value={asset.domain_expiry ? new Date(asset.domain_expiry).toLocaleDateString() : null}
                      alert={isExpired(asset.domain_expiry) || isExpiringSoon(asset.domain_expiry)}
                    />
                  </>
                )}
                {Number(asset.ssl_cost) > 0 && (
                  <>
                    <Field label="Costo SSL" value={`$${Number(asset.ssl_cost).toLocaleString()}`} />
                    <Field
                      label="Vence SSL"
                      value={asset.ssl_expiry ? new Date(asset.ssl_expiry).toLocaleDateString() : null}
                      alert={isExpired(asset.ssl_expiry) || isExpiringSoon(asset.ssl_expiry)}
                    />
                  </>
                )}
                {Number(asset.hosting_cost) > 0 && (
                  <>
                    <Field label="Costo Hosting" value={`$${Number(asset.hosting_cost).toLocaleString()}`} />
                    <Field
                      label="Vence Hosting"
                      value={asset.hosting_expiry ? new Date(asset.hosting_expiry).toLocaleDateString() : null}
                      alert={isExpired(asset.hosting_expiry) || isExpiringSoon(asset.hosting_expiry)}
                    />
                  </>
                )}
                {Number(asset.server_cost) > 0 && (
                  <>
                    <Field label="Costo Servidor" value={`$${Number(asset.server_cost).toLocaleString()}`} />
                    <Field
                      label="Vence Servidor"
                      value={asset.server_expiry ? new Date(asset.server_expiry).toLocaleDateString() : null}
                      alert={isExpired(asset.server_expiry) || isExpiringSoon(asset.server_expiry)}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Costos */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Costos
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Costo Contable" value={asset.monthly_cost != null ? `$${Number(asset.monthly_cost).toLocaleString()}` : null} />
              <Field label="Costo Anual" value={asset.annual_cost != null ? `$${Number(asset.annual_cost).toLocaleString()}` : null} />
            </div>
          </div>

          {/* Notas */}
          {asset.notes && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Notas
              </h4>
              <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3">{asset.notes}</p>
            </div>
          )}

          {/* Código del Activo + QR */}
          {asset.asset_code && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Código del Activo
              </h4>
              <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-lg">
                <QRCodeCanvas id="qr-code-canvas" value={asset.asset_code} size={100} />
                <div className="flex flex-col gap-2">
                  <span className="text-2xl font-mono font-bold text-foreground">
                    {asset.asset_code}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"

                    /* onClick={() => {
                       const printWindow = window.open('', '_blank');
                       printWindow?.document.write(`
                      <html><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:monospace;">
                      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                   ${document.querySelector('svg')?.innerHTML || ''}
                     </svg>
                      <p style="font-size:24px;font-weight:bold;margin-top:16px;">${asset.asset_code}</p>
                     <p style="font-size:14px;color:#666;">${asset.name}</p>
                       </body>
                     </html>
                    `);
                       printWindow?.document.close();
                       printWindow?.print();
                     }}*/

                   onClick={() => {
  const canvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
  const imgSrc = canvas.toDataURL('image/png');

  const printWindow = window.open('', '_blank', 'width=500,height=600');
  printWindow?.document.write(`
    <html>
      <head>
        <title>Etiqueta - ${asset.asset_code}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: auto; margin: 0mm; }
          body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            font-family: monospace;
            padding: 20px;
          }
          img { width: 300px; height: 300px; image-rendering: pixelated; }
          .code { font-size: 28px; font-weight: bold; margin-top: 16px; letter-spacing: 2px; }
          .name { font-size: 16px; color: #444; margin-top: 8px; }
        </style>
      </head>
      <body>
        <img src="${imgSrc}" />
        <p class="code">${asset.asset_code}</p>
        <p class="name">${asset.name}</p>
      </body>
    </html>
  `);
  printWindow?.document.close();
  setTimeout(() => printWindow?.print(), 300);
}}

                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir Etiqueta
                  </Button>
                </div>
              </div>
            </div>
          )}





        </div>
      </DialogContent>
    </Dialog>
  );
}