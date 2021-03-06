// funciones controlador auth.js
var mongoose = require('mongoose');
// probar con mongoose.model('User'); CASA ADOLFO	
var User = require('../models/user');
// var Empresa = require('../models/emp-domiciliario');
var Empresa = mongoose.model('EmpDomiciliarioModel');
//para crear el token uso este service
var service = require('../service/token');
var bcrypt = require('bcrypt');

var request = require('request');

var request = require('request');
var qs = require('querystring');
var config = require('../config');

var nodemailer = require('nodemailer');

// creo un objeto encargado de transportar el mensaje por medio del protocolo SMTP
// este objeto se crea una sol vez y se puede utulizar por los diferentes metodos de la app
var transporter = nodemailer.createTransport({
	service: 'Gmail',
	auth:{
		user: 'elkinjuc@gmail.com',
		pass: 'rootshell'
	}
});

//POR VER PUESTO DONDE ADOLFO
var jwt = require('jwt-simple');

exports.twitterLogin = function(req,res){
	res.send('hello');	
}

exports.faceAdentro = function(req, res){
	res.json('hola');
}

exports.hola = function(req, res){
	res.json('hola mundo');
}


//function para registro con facebook
exports.faceLogin = function(req, res){

	var accessTokenUrl = 'https://graph.facebook.com/v2.3/oauth/access_token';
	var graphApiUrl = 'https://graph.facebook.com/v2.3/me';

	var params = {
		code: req.body.code,
		client_id: req.body.clientId,
		client_secret: config.FACEBOOK_SECRET,
		redirect_uri: req.body.redirectUri
	};

	//Step 1 Exchange authorization code for access token
	request.get({ url: accessTokenUrl, qs: params, json: true}, function(err, response, accessToken){
		if(response.statusCode !== 200){
			return res.status(500).send({ message: accessToken.error.message });
		}
	

	//Step 2 Retrieve profile info about current user
	request.get({ url: graphApiUrl, qs: accessToken, json: true}, function(err, response, profile){
		if(response.statusCode !== 200){
			return res.status(500).send({ message: profile.error.message });
		}
		// si hay accessToken y envian headers de auth busca en db o crea
		if (req.headers.authorization){
			User.findOne({ facebook: profile.id}, function(err, existingUser){
				if(existingUser){
					return res.status(409).send({message: 'Ya existe una cuenta de facebook que te pertenece'});
				}
				// si no existe el user en facebook pero si hay authorization header crear token
				var token = req.headers.authorization.split(' ')[1];
				var payload = jwt.decode(token, config.TOKEN_SECRET);
				User.findById(payload.sub, function(err, user){
					if(!user){
						return res.status(400).send({ message: 'User not found'});
					}
					// Retorno usuario

					// si el user si es encontrado
					user.facebook = profile.id;
					user.picture = user.picture || 'http://graph.facebook.com/v2.3/'+profile.id+'/picture?type=large';
					user.usuario = user.usuario || profile.name;
					user.nombre = user.nombre || profile.name;
					user.email = user.email || profile.email;

					console.log('USUARIO: '+profile.name);

					user.save(function(){
						var token = service.createToken(user);
						// devuelvo el token
						res.send({userId: user._id, token: token});
					});
				});
			});
		} else {
			// Step 3b. Create new user account or return an existing one
			User.findOne({ facebook: profile.id}, function(err, existingUser){
				if(existingUser){
					var token = service.createToken(existingUser);
					return res.send({userId: existingUser._id, token: token });
				}
				var user = new User();
				user.facebook = profile.id;
				user.picture = 'https://graph.facebook.com/'+ profile.id + '/picture?type=large';
				user.usuario = profile.name;
				user.nombre = profile.name;
				user.email = profile.email;
				console.log('USUARIO: '+profile.name);

				user.save(function(err){
					if (err) {return res.send({message: 'Error al almacenar los datos de facebook'}) }//Si hubo error
					var token = service.createToken(user);
					res.send({userId: user._id, token: token});
				});
			});
		}
	});
});
} // fin faceLogin function


exports.unlinkProvider = function(req, res){
	var provider = req.params.provider;
	var providers = ['facebook'];

	if(provider.indexOf(providers) === -1){
		return res.status(400).send('Unknown Provider');
	}

	User.findById(req.user, function(err, user){
		if(!user){
			return res.status(400).send({message: 'User not found'});
		}
		user[provider] = undefined;
		user.save(function(){
			res.status(200).end();
		});
	});
}


// function para registro de usuario crea el token
exports.emailSignup = function(req, res){

	console.log('ROL: ' + req.body.roll);
	// identifico el rol de la peticion
	if (req.body.roll == 'Empresa') {
		// if(req.files.foto){
		// console.log('Cargando el archivo de la Imagen ...');
		// var foto = req.files.foto.name;
		// } else {
		// 	// si no da foto poner foto default
		// 	var foto = "noimage.png";
		// }
		var empresa = new Empresa({
			usuario: req.body.usuario,
			password: req.body.password,
			nombreEmpresa: req.body.nombreEmpresa,
			tarifaKm: req.body.tarifaKm,
			email: req.body.email,
			telefono: req.body.telefono,
			nitEmpresa:req.body.nitEmpresa,
			logoEmpresa: req.body.logoEmpresa
		});

		// domi.save(function(err, data){
		// 	if (err) res.send(err);
		// 	res.json({message:"se agrego el domiciliario", data: data});
		// });
		
		empresa.save(function(err){
			if (err) {return res.send({message: 'Error al almacenar los datos de l empresa'}) }//Si hubo error

			return res // si todo esta bien
				.status(200)
				.send({empresa: empresa, token: service.createToken(empresa)});
		});
	}else{

	// fin validacion de rol

	var user = new User({
		nombre: req.body.nombre,
		email:req.body.email,
		telefono:req.body.telefono,
		usuario: req.body.usuario,
		password: req.body.password
		// acá pongo el resto de parametros del modelo
	});

	// envio mail al usuario registrado
	// los datos de configuracion de correo con simbolo unicode
	var mailOptions = {
		from: 'Domisil Team <elkin@oglit.com>',
		to: req.body.email,
		subject: 'Confirmación de registro',
		text: 'Registro de usuario',
		html: "<h1 style='color: #c0392b;'>Registro éxitoso!</h1> <p style='color:#7f8c8d;'>Usted se ha registrado correctamente en <a href='http://www.domisil.co'>Domisil.co</a></p>"
	};

	// bcrypt.hash(req.body.password, 10, function(err, hash){
		// user.password = hash;
	
		user.save(function(err){
			if (err) {return res.send({message: 'Error al almacenar los datos'}) }//Si hubo error

			return res // si todo esta bien
				.status(200)
				.send({userId: user._id, token: service.createToken(user)});

			// Envio el mail con el transportador definido
			transporter.sendMail(mailOptions, function(error, info){
			if (error) {
				return console.log(error);
			}
				console.log('Mensaje enviado: ' + info.response);
			});
		});
	// });
}
};


// prueba libro mean bcrypt - 
// function validateUser(user, password, cb){
// 	bcrypt.compare(password, user.password, cb);
// }

// function para ingresar usuario al sistema
exports.emailLogin = function(req, res){
	// empresa
	if (req.body.roll == "Empresa") {
		Empresa.findOne({usuario: req.body.usuario}, function(err, empresa){
		if (err) next(err);
		if(!empresa) {return res.status(401).send({message: 'No existe ese usuario'})}	
		empresa.comparePassword(req.body.password, function(err, entra){
			if (err) throw err;
			if(!entra){return res.status(401).send({message: "Contraseña incorrecta", result:entra, pwd:empresa.password, llega:req.body.password})}
			console.log(req.body.password, 'Estado: ' + entra);
			return res
				.status(200)
				.send({ empresa: empresa, token: service.createToken(empresa) });
		});

		});
	}else{
	
	// user
	User.findOne({ usuario: req.body.usuario }, function(err, user){
		if (err) next(err);
		if(!user) {return res.status(401).send({message: 'No existe ese usuario'})}
		// aqui viene comprobacion de contraseña bcrypt

		// 	if (req.body.password === null) { return res.status(401).send({message:'Ingrese su password'})}
		user.comparePassword(req.body.password, function(err, entra){
			// if (err) { return res.status(401).send({message: 'Contraseña incorrecta'})};
			// if (err) {return res.status(401).send({message:'Error en los datos'})};
			if (err) throw err;
			if(!entra){return res.status(401).send({message: "Contraseña incorrecta", result:entra, pwd:user.password, llega:req.body.password})}
			console.log(req.body.password, 'Estado: ' + entra);
			return res
				.status(200)
				.send({ userId: user._id, token: service.createToken(user) });
		});
	});
	}
	// User.findOne({ usuario: req.body.usuario }, function(err, user){
	// 	if (err) next(err);
	// 	if(!user) res.status(401).send({message: 'No existe ese usuario'});
	// 	// aqui viene comprobacion de contraseña bcrypt
	// 	if (req.body.password === null) { return res.status(401).send({message:'Ingrese su password'})}
	// 	if(req.body.password !== null){
	// 		validateUser(req.body.password, user, function(err, valid){
	// 			if(err || !valid){ return res.status(401).send({message: 'Contraseña incorrecta'})}
	// 			// si no hay error y contraseña es igual devuelvo el token con payload
	// 			console.log(user._id);
	// 			return res
	// 				.status(200)
	// 				.send({ userId: user._id, token: service.createToken(user) });	
	// 		});
	// 	} else{
	// 		return res.send({message:'llenar el formulario'});
	// 	}	
	// });
};