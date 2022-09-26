const { URL } = require('node:url');
const express = require('express');
const basicAuth = require('express-basic-auth');
const Queue = require('bull');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const Redis = require('ioredis');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  serverAdapter,
  queues: createQueueInstances(getQueueNames()).map(
    (queue) => new BullAdapter(queue)
  ),
});

const app = express();

app.use(
  basicAuth({
    users: getUsers(),
    challenge: true,
  })
);

app.use('/admin/queues', serverAdapter.getRouter());

// other configurations of your server

app.listen(3000, () => {
  console.log('Running on 3000...');
});

function getQueueNames(envName = 'QUEUES') {
  const queues = process.env[envName];
  return queues ? queues.split(',') : [];
}

/**
 * @param {string[]} names
 */
function createQueueInstances(names) {
  const redisOptions = parseRedisURL(process.env.REDIS_URL_QUEUE);
  const redisClient = new Redis(redisOptions);
  const createClient = (type, config) => {
    if (['bclient', 'subscriber'].includes(type)) {
      return new Redis({
        ...redisOptions,
        ...config,
        maxRetriesPerRequest: null,
      });
    } else {
      return redisClient;
    }
  };
  return names.map((name) => new Queue(name, { createClient }));
}

/**
 * @param {string} url
 */
function parseRedisURL(url) {
  const { password, hostname, port, pathname } = new URL(url);
  return {
    host: hostname,
    port: parseInt(port),
    password,
    db: pathname ? parseInt(pathname.slice(1)) : undefined,
  };
}

function getUsers() {
  const [username, password] = process.env.BASIC_AUTH_CREDANTIAL.split(':');
  return {
    [username]: [password],
  };
}
