import { MongoClient } from 'mongodb';

export class BaseDatosMongoDB {
  constructor() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("La variable de entorno MONGODB_URI no está definida");
    }
    this.client = new MongoClient(uri);
    this.db = null;
    this.usuariosCollection = null;
  }

  async conectar() {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db('saas_db');
      this.usuariosCollection = this.db.collection('usuarios');
      console.log('Conectado exitosamente a MongoDB Atlas');
    }
  }

  async guardar(usuario) {
    await this.conectar();
    await this.usuariosCollection.insertOne(usuario);
    return usuario;
  }

  async obtenerPorEmail(email) {
    await this.conectar();
    return await this.usuariosCollection.findOne({ email });
  }

  async obtenerTodos() {
    await this.conectar();
    return await this.usuariosCollection.find({}).toArray();
  }

  async eliminar(email) {
    await this.conectar();
    const resultado = await this.usuariosCollection.deleteOne({ email });
    return resultado.deletedCount > 0;
  }
}