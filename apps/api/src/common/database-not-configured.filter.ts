/**
 * Sem `DATABASE_URL`, toda rota que toca no banco responde
 * `503 {error:'O banco de dados de contas ainda não foi configurado.'}`
 * — mesma resposta do `if(!pool)` no topo do `handle()` do accounts.js
 * original.
 *
 * O original checava antes de rotear; aqui a checagem acontece quando a
 * primeira query pede a conexão. O efeito visto de fora é o mesmo, e as
 * rotas que não tocam no banco (`/api/rooms`, `/health`,
 * `/api/account/status`) continuam respondendo normalmente.
 */

import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

import { DatabaseNotConfiguredError } from '../db/client';

@Catch(DatabaseNotConfiguredError)
export class DatabaseNotConfiguredFilter implements ExceptionFilter<DatabaseNotConfiguredError> {
  private readonly logger = new Logger(DatabaseNotConfiguredFilter.name);

  catch(exception: DatabaseNotConfiguredError, host: ArgumentsHost): void {
    // Filtro global vale também pro contexto de socket, onde não existe
    // resposta HTTP pra escrever. Lá o gateway já trata por conta própria.
    if (host.getType() !== 'http') {
      this.logger.error(exception.message);
      return;
    }
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.SERVICE_UNAVAILABLE).json({ error: 'O banco de dados de contas ainda não foi configurado.' });
  }
}
