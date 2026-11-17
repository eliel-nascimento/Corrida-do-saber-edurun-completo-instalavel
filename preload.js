const { contextBridge, ipcRenderer } = require('electron');
const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('api', {
  // jogo
  getConfig: call('config:get'),
  getQuestions: call('questions:get'),
  log: call('log:append'),
  askAI: call('ai:ask'),
  // administrador (o processo principal recusa se não houver login)
  adminStatus: call('admin:status'),
  adminSetup: call('admin:setup'),
  adminLogin: call('admin:login'),
  adminLogout: call('admin:logout'),
  adminChangePassword: call('admin:changePassword'),
  adminGetConfig: call('admin:config:get'),
  adminSaveConfig: call('admin:config:save'),
  adminSaveQuestions: call('admin:questions:save'),
  adminResetQuestions: call('admin:questions:reset'),
  adminReadEvents: call('admin:events:read'),
  adminClearEvents: call('admin:events:clear'),
  adminSaveCsv: call('admin:csv:save'),
  adminOpenData: call('admin:data:open')
});
