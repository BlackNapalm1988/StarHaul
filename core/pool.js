export function createPool(factory, initialSize = 0){
  const pool = [];
  for(let i=0;i<initialSize;i++){
    pool.push(factory());
  }
  return {
    acquire(){
      return pool.length ? pool.pop() : factory();
    },
    release(obj){
      pool.push(obj);
    },
    size(){
      return pool.length;
    }
  };
}
