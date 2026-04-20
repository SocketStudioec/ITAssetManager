# TechAssets Pro - Documentación Técnica

## Resumen Ejecutivo

TechAssets Pro es una aplicación web integral para la gestión de activos IT dirigida a pequeñas y medianas empresas (PyMES). El sistema permite el seguimiento, gestión y optimización de recursos tecnológicos incluyendo activos físicos, aplicaciones de software, contratos, licencias y registros de mantenimiento.

## Arquitectura del Sistema

### Stack Tecnológico

#### Frontend
- **Framework**: React 18 con TypeScript
- **Build Tool**: Vite para desarrollo y bundling optimizado  
- **Routing**: Wouter para routing ligero del lado cliente
- **State Management**: TanStack Query (React Query v5) para manejo de estado del servidor
- **UI Components**: Radix UI primitives con shadcn/ui component library
- **Styling**: Tailwind CSS con tokens de diseño personalizados
- **Forms**: React Hook Form con validación Zod
- **Charts**: Recharts para visualización de datos

#### Backend  
- **Runtime**: Node.js con Express.js framework
- **Language**: TypeScript con módulos ES
- **API Pattern**: RESTful API con handlers de rutas dedicados
- **Middleware**: Logging personalizado, manejo de errores y autenticación
- **File Structure**: Monorepo con schemas compartidos entre cliente y servidor

#### Base de Datos
- **Database**: PostgreSQL 15
- **ORM**: Drizzle ORM para operaciones type-safe
- **Schema**: Definiciones de schema centralizadas en directorio compartido
- **Migrations**: Drizzle Kit para manejo de schema de base de datos
- **Validation**: Schemas Zod para validación de tipos en tiempo de ejecución

#### Autenticación y Autorización
- **Provider**: Autenticación Email/Password (independiente de plataforma)
- **Password Security**: Bcrypt con 10 salt rounds para hashing seguro
- **Session Management**: Express sessions con almacén PostgreSQL (connect-pg-simple)
- **User Management**: Control de acceso basado en roles con permisos por empresa
- **Roles**: Super Admin, Technical Admin, Manager/Owner
- **Session Secret**: Configurable vía variable de entorno SESSION_SECRET

## Modelo de Base de Datos

### Diseño Multi-Tenant

El sistema utiliza una arquitectura multi-tenant con las siguientes entidades principales:

#### Entidades Principales

1. **users**: Gestión de autenticación y perfiles
2. **companies**: Soporte multi-tenancy con relaciones usuario-empresa
3. **assets**: Dispositivos físicos, aplicaciones y recursos digitales
4. **contracts**: Acuerdos con proveedores y contratos de servicio
5. **licenses**: Seguimiento de licencias de software y compliance
6. **maintenance_records**: Historial de servicio y mantenimiento programado
7. **activity_log**: Registro de auditoría para todas las operaciones del sistema

### Relaciones Clave

- **Usuario-Empresa**: Many-to-many con roles específicos por empresa
- **Empresa-Activos**: One-to-many con aislamiento por companyId
- **Activos-Mantenimiento**: One-to-many para historial de servicios
- **Licencias-Activos**: Many-to-one para asociación de licencias

## Arquitectura Backend

### Patrón Repository

```typescript
// Interfaz que define todas las operaciones de datos
interface IStorage {
  // Operaciones de usuario
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(userData: CreateUser): Promise<User>;
  
  // Operaciones de empresa
  getUserCompanies(userId: string): Promise<(UserCompany & { company: Company })[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  
  // Operaciones CRUD para activos, contratos, licencias, mantenimiento
  // Analytics para dashboard y reportes
  // Sistema de auditoría completo
}

// Implementación usando Drizzle ORM y PostgreSQL
class DatabaseStorage implements IStorage {
  // Implementaciones optimizadas con manejo de errores
  // Queries complejos para analytics y reportes
  // Transacciones para operaciones críticas
}
```

### Rutas de API Organizadas

#### Autenticación
- `GET /api/auth/user` - Perfil del usuario actual
- `POST /api/login` - Inicio de sesión con email/password  
- `POST /api/logout` - Cierre de sesión

#### Gestión de Empresas
- `GET /api/companies` - Empresas del usuario
- `POST /api/companies` - Crear nueva empresa

#### Dashboard y Analytics
- `GET /api/dashboard/:companyId/summary` - KPIs y métricas principales
- `GET /api/dashboard/:companyId/activity` - Log de actividad reciente

#### Gestión de Activos
- `GET /api/assets/:companyId` - Lista de activos
- `POST /api/assets` - Crear nuevo activo
- `PUT /api/assets/:id` - Actualizar activo
- `DELETE /api/assets/:id/:companyId` - Eliminar activo

#### Contratos y Licencias
- `GET /api/contracts/:companyId` - Contratos de la empresa
- `GET /api/licenses/:companyId` - Licencias de software

#### Mantenimiento
- `GET /api/maintenance/:companyId` - Registros de mantenimiento
- `POST /api/maintenance` - Crear registro de mantenimiento

#### Administración (Solo Super Admin)
- `GET /api/admin/companies` - Todas las empresas del sistema
- `PUT /api/admin/companies/:id/plan` - Cambiar plan de empresa
- `POST /api/admin/support-access/:companyId` - Entrar en modo soporte

## Arquitectura Frontend

### Estructura de Componentes

```
client/src/
├── components/
│   ├── layout/           # Header, Sidebar, layouts principales
│   ├── ui/              # Componentes base (shadcn/ui)
│   └── forms/           # Formularios específicos
├── pages/               # Páginas principales de la app
├── hooks/               # Custom hooks reutilizables
├── lib/                 # Utilidades y configuración
└── assets/              # Recursos estáticos
```

### State Management

#### TanStack Query para Estado del Servidor
```typescript
// Configuración de queries con invalidación automática
const { data: companies } = useQuery({
  queryKey: ["/api/companies"],
  enabled: isAuthenticated,
  retry: false,
});

// Mutaciones con optimistic updates
const createAsset = useMutation({
  mutationFn: (data) => apiRequest('/api/assets', data),
  onSuccess: () => {
    queryClient.invalidateQueries(['/api/assets', companyId]);
  }
});
```

#### Estado Local con React Hooks
- `useState` para formularios y UI estado temporal
- `useEffect` para side effects y lifecycle
- Custom hooks para lógica reutilizable

### Routing con Wouter

```typescript
// Router principal con protección de rutas
<Switch>
  {isLoading || !isAuthenticated ? (
    <Route path="/" component={Landing} />
  ) : (
    <>
      <Route path="/" component={Home} />
      <Route path="/assets" component={Assets} />
      <Route path="/admin" component={AdminPanel} />
    </>
  )}
</Switch>
```

## Funcionalidades Principales

### Sistema Multi-Empresa
- Un usuario puede pertenecer a múltiples empresas
- Aislamiento completo de datos por empresa (multi-tenancy)
- Roles específicos por empresa: Super Admin, Technical Admin, Manager/Owner, Technician

### Gestión de Activos
- **Activos Físicos**: Laptops, servidores, impresoras, hardware en general
- **Aplicaciones**: Software SaaS, desarrollos personalizados
- **Información Completa**: Costos, garantías, ubicación, responsable
- **Estados de Activos**: Activo, Inactivo, En Mantenimiento, Depreciado, Eliminado

### Dashboard y Analytics
- **KPIs en Tiempo Real**: Costos totales mensuales/anuales por categoría
- **Contadores de Activos**: Físicos, aplicaciones, licencias, contratos
- **Gráficos Interactivos**: Visualización de datos con Recharts
- **Log de Actividad**: Timeline de todas las acciones importantes

### Planes de Suscripción
- **Profesional**: 1 usuario, 100 activos máximo
- **PyME**: 50 usuarios, 1000 activos máximo
- **Gestión Dinámica**: Super admin puede cambiar planes y límites

### Modo Soporte (Super Admin)
- Acceso temporal a cualquier empresa para soporte técnico
- Indicadores visuales claros en toda la interfaz
- Logging automático de todas las acciones en modo soporte
- Botón de salida rápida del modo soporte

### Sistema de Notificaciones
- Alertas de vencimiento de servicios
- Notificaciones de mantenimiento programado
- Contadores de notificaciones no leídas
- Sistema en tiempo real con polling

## Seguridad

### Autenticación
- Autenticación Email/Password con bcrypt para seguridad
- Tokens JWT con refresh automático
- Sesiones persistentes en PostgreSQL
- Logout completo con limpieza de sesiones

### Autorización
- Control de acceso basado en roles (RBAC)
- Verificación de permisos en cada endpoint
- Aislamiento de datos por empresa (multi-tenancy)
- Middleware de autenticación en todas las rutas protegidas

### Validación de Datos
- Esquemas Zod para validación de entrada
- Sanitización automática de datos
- Prevención de SQL injection via ORM
- Validación tanto en frontend como backend

### Auditoría
- Log completo de todas las operaciones CRUD
- Información de usuario, timestamp y detalles de cambios
- Sistema de activity log para compliance
- Logging específico para acciones de super admin

## Deployment

### Entorno de Desarrollo
- Compatible con cualquier plataforma de desarrollo y deployment
- Hot Module Replacement (HMR) con Vite
- Base de datos PostgreSQL local o remoto
- Variables de entorno para configuración

### Preparado para Producción
- Build optimizado con Vite
- Compresión y minificación automática
- Assets estáticos con cache headers
- Health checks integrados
- Configuración para AlmaLinux deployment

## Base de Datos de Prueba

El sistema incluye datos de prueba completos:

### Empresas de Prueba
- **2 Empresas Profesionales**: Consultores independientes
- **3 Empresas PyME**: Startups y corporaciones medianas

### Datos por Empresa
- **Usuarios**: Con roles diferenciados (Owner, Admin, Technician)
- **Activos Físicos**: Mínimo 3 por empresa (laptops, servidores, equipos)
- **Aplicaciones**: 6 por empresa (mix de SaaS y desarrollo personalizado)
- **Contratos**: Acuerdos con proveedores principales
- **Licencias**: Software con diferentes tipos de licenciamiento

## Extensibilidad

### Patrón de Arquitectura
- Separación clara de responsabilidades (MVC)
- Interfaces bien definidas para fácil testing
- Componentes reutilizables y modulares
- Schema compartido entre frontend y backend

### APIs Preparadas para Escalado
- Endpoints RESTful consistentes
- Paginación preparada para grandes datasets
- Filtros y búsquedas optimizadas
- Rate limiting preparado

### Base de Datos Escalable
- Índices optimizados en columnas de búsqueda frecuente
- Relaciones eficientes con foreign keys
- Posibilidad de sharding por empresa
- Backup y recovery procedures

## Conclusión

TechAssets Pro es una solución completa y escalable para la gestión de activos IT. Su arquitectura moderna, patrones de desarrollo sólidos y enfoque en seguridad lo hacen ideal tanto para deployment inmediato como para crecimiento futuro. La documentación completa en el código facilita el mantenimiento y la incorporación de nuevos desarrolladores al proyecto.