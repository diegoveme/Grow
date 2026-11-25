import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/setup';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    // Boot without a database so the suite never touches a real one.
    for (const key of ['DATABASE_URL', 'DATABASE_HOST', 'DATABASE_PASSWORD']) {
      delete process.env[key];
    }
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health reports ok with in-memory storage', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'memory' });
  });

  it('rejects a malformed address before touching the network', () => {
    return request(app.getHttpServer()).get('/api/accounts/not-an-address').expect(400);
  });

  it('rejects amounts that are not plain decimals', () => {
    return request(app.getHttpServer())
      .post('/api/remittances/preview')
      .send({ amount: '-5' })
      .expect(400);
  });

  it('previews a 70/30 split by default', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/remittances/preview')
      .send({ amount: '200' })
      .expect(201);
    expect(res.body).toMatchObject({ spendable: '140.0000000', vault: '60.0000000' });
  });
});
