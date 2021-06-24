/* eslint-disable @typescript-eslint/ban-types */
import type Ajv from "ajv/dist/jtd"
import type {JTDSchemaType} from "ajv/dist/jtd"
import type {Context, Request} from "koa"
import {text} from "co-body"

export type KoaContext<Props extends object = Record<string, never>, T = unknown> = _KoaContext<T> & Props

interface _KoaContext<T> extends Context {
  request: KoaRequest<T>
}

interface KoaRequest<T = unknown> extends Request {
  body: T
}

type Handler<P extends object, T = unknown> = (cxt: KoaContext<P, T>) => Promise<void>

type BodyParser<P extends object> = <T>(schema: JTDSchemaType<T>, handler: Handler<P, T>) => Handler<P>

export default function getParseBody<P extends object = Record<string, never>>(ajv: Ajv): BodyParser<P> {
  return <T>(schema: JTDSchemaType<T>, handler: Handler<P, T>): Handler<P> => {
    const parse = ajv.compileParser(schema)

    return async (cxt: KoaContext<P>): Promise<void> => {
      const str = await jsonBodyStr(cxt)
      const data = str !== undefined && parse(str)
      if (data === undefined) {
        cxt.status = 400
        cxt.body = {error: parse.message}
        return
      }
      cxt.request.body = data
      await handler(cxt as KoaContext<P, T>)
    }
  }
}

const jsonTypes = ["json", "application/*+json"]

async function jsonBodyStr<P extends object>(cxt: KoaContext<P>): Promise<string | undefined> {
  if (cxt.request.is(jsonTypes)) return text(cxt.request)
  const type = cxt.request.headers["content-type"] || ""
  cxt.status = 415
  cxt.response.body = type ? `Unsupported content-type: ${type}` : "Missing content-type"
  return undefined
}
