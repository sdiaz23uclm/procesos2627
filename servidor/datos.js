import { MongoClient } from 'mongodb';

// Filtro de "cuenta vigente": las cuentas eliminadas (borrado lógico, D-12) se conservan
// en la colección pero no se devuelven en las búsquedas por email ni por token.
const VIGENTE = { estado: { $ne: 'eliminado' } };

export class BaseDatosMongoDB {
  constructor() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("La variable de entorno MONGODB_URI no está definida");
    }
    this.client = new MongoClient(uri);
    this.db = null;
    this.usuariosCollection = null;
    this.sesionesCollection = null;
    this.partidasCollection = null;
  }

  async conectar() {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db('saas_db');
      this.usuariosCollection = this.db.collection('usuarios');
      this.sesionesCollection = this.db.collection('sesiones');
      this.partidasCollection = this.db.collection('partidas');
      await this.partidasCollection.createIndex({ email: 1 }, { unique: true });
      // MongoDB borra solo las sesiones cuando llega su fecha de caducidad (índice TTL)
      await this.sesionesCollection.createIndex({ expira: 1 }, { expireAfterSeconds: 0 });
      console.log('Conectado exitosamente a MongoDB Atlas');
    }
  }

  // ---------- Usuarios ----------

  async guardar(usuario) {
    await this.conectar();
    await this.usuariosCollection.insertOne(usuario);
    return usuario;
  }

  async obtenerPorEmail(email) {
    await this.conectar();
    return await this.usuariosCollection.findOne({ email, ...VIGENTE });
  }

  async obtenerPorTokenConfirmacion(tokenHash) {
    await this.conectar();
    return await this.usuariosCollection.findOne({ tokenConfirmacionHash: tokenHash, ...VIGENTE });
  }

  // Incluye las cuentas eliminadas: el administrador ve su estado en el listado
  async obtenerTodos() {
    await this.conectar();
    return await this.usuariosCollection.find({}).toArray();
  }

  async actualizar(email, cambios) {
    await this.conectar();
    const resultado = await this.usuariosCollection.updateOne({ email, ...VIGENTE }, { $set: cambios });
    return resultado.matchedCount > 0;
  }

  // Borrado físico: solo se usa para deshacer un registro cuyo correo no se pudo enviar
  async eliminar(email) {
    await this.conectar();
    const resultado = await this.usuariosCollection.deleteOne({ email, ...VIGENTE });
    return resultado.deletedCount > 0;
  }

  // ---------- Sesiones (D-13) ----------

  async crearSesion(idHash, email, expira) {
    await this.conectar();
    await this.sesionesCollection.insertOne({ _id: idHash, email, expira });
  }

  async obtenerSesion(idHash) {
    await this.conectar();
    const sesion = await this.sesionesCollection.findOne({ _id: idHash });
    // El índice TTL tarda hasta un minuto en borrar: se comprueba también aquí
    if (!sesion || sesion.expira < new Date()) return null;
    return sesion;
  }

  async eliminarSesion(idHash) {
    await this.conectar();
    await this.sesionesCollection.deleteOne({ _id: idHash });
  }

  async eliminarSesionesDe(email) {
    await this.conectar();
    await this.sesionesCollection.deleteMany({ email });
  }

  // ---------- Partidas de Alianzas (D-21) ----------

  async obtenerPartida(email) {
    await this.conectar();
    return await this.partidasCollection.findOne({ email }, { projection: { _id: 0 } });
  }

  // Una partida por usuario: una nueva sustituye a la anterior
  async crearPartida(partida) {
    await this.conectar();
    await this.partidasCollection.replaceOne({ email: partida.email }, partida, { upsert: true });
  }

  // Solo guarda si la versión en BD sigue siendo la que se leyó (control optimista)
  async actualizarPartida(partida, versionAnterior) {
    await this.conectar();
    const resultado = await this.partidasCollection.replaceOne(
      { email: partida.email, version: versionAnterior },
      partida
    );
    return resultado.matchedCount > 0;
  }

  async eliminarPartida(email) {
    await this.conectar();
    await this.partidasCollection.deleteOne({ email });
  }
}
