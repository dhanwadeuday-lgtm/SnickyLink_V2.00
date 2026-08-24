export type Bindings = {
  DB: D1Database
  JWT_ACCESS_SECRET: string
  JWT_REFRESH_SECRET: string
}

export type AuthUser = {
  id: string
  email: string
  role: 'user' | 'admin'
  coupleId: string | null
}

export type Variables = {
  user: AuthUser
}

export type AppEnv = { Bindings: Bindings; Variables: Variables }
