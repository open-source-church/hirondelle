
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/HomePage.vue') },
      { path: ':tab', component: () => import('pages/IndexPage.vue'), props: true },
      // { path: 'source/:peer_id', component: () => import('pages/OBSSource.vue'), props: true },
    ]
  },
  {
    path: '/source/',
    component: () => import('layouts/SourceLayout.vue'),
    children: [
      { path: ':peer_id', component: () => import('pages/OBSSource.vue'), props: true },
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
