import { Elysia } from 'elysia'
import { fontsRoutes } from './fonts'
import { gitRoutes } from './git'

export const routes = new Elysia().use(fontsRoutes).use(gitRoutes)
