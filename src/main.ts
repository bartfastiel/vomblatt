import { startApp } from './ui/app';
import { registerServiceWorker } from './ui/register-sw';
import './ui/styles.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (app === null) throw new Error('#app missing');

startApp(app);

if (import.meta.env.PROD) registerServiceWorker();
