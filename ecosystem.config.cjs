/**
 * Configuración PM2 para ITAssetManager (techassets.socket-studio.com)
 *
 * Uso en el servidor:
 *   cd /var/www/apps-node/ITAssetManager
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *
 * Claves importantes:
 * - cwd: garantiza que dotenv encuentre el .env aunque PM2 se lance desde /root
 * - min_uptime + max_restarts: si la app muere 10 veces sin llegar a 10s viva,
 *   PM2 la marca como "errored" y DEJA de reiniciarla (evita el bucle de
 *   millones de reinicios)
 * - exp_backoff_restart_delay: espera creciente entre reinicios
 */
module.exports = {
  apps: [
    {
      name: "ITAssetManager",
      script: "dist/index.js",
      cwd: "/var/www/apps-node/ITAssetManager",
      instances: 1,
      exec_mode: "fork",

      // Control del bucle de reinicios
      min_uptime: "10s",
      max_restarts: 10,
      exp_backoff_restart_delay: 200,

      // Reinicio preventivo si hay fuga de memoria
      max_memory_restart: "400M",

      env: {
        NODE_ENV: "production",
        PORT: "5000",
        HOST: "127.0.0.1",
        // DATABASE_URL y JWT_SECRET se leen del archivo .env
        // (server/db.ts carga dotenv). No poner secretos aquí:
        // este archivo se versiona en git.
      },

      // Logs con timestamp
      time: true,
      error_file: "/var/log/pm2/itassetmanager-error.log",
      out_file: "/var/log/pm2/itassetmanager-out.log",
      merge_logs: true,
    },
  ],
};
