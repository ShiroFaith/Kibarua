/**
 * Register a route under both its plain path and a `.php`-suffixed alias so the
 * API matches every frontend client - some call `/jobs/create`, others call
 * `/jobs/create.php` (a carry-over from the platform's PHP prototype).
 *
 * Usage:
 *   const add = aliasRouter(router);
 *   add('post', 'create', requireAuth, asyncHandler(ctrl.create));
 *   add('get',  ['list', ''], asyncHandler(ctrl.list)); // '' → the router root
 */
export function aliasRouter(router) {
  return (method, names, ...handlers) => {
    const list = Array.isArray(names) ? names : [names];
    for (const name of list) {
      const base = name ? `/${name}` : '/';
      router[method](base, ...handlers);
      if (name) router[method](`/${name}.php`, ...handlers);
    }
  };
}

export default aliasRouter;
