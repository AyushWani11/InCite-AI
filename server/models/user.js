const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); // or bcryptjs, whichever you prefer
const Schema = mongoose.Schema;

const userSchema = new Schema(
	{
		username: {
			type: String,
			required: [true, 'Username is required'],
			unique: true,
			trim: true,
			minlength: [3, 'Username must be at least 3 characters'],
		},
		email: {
			type: String,
			required: [true, 'Email is required'],
			unique: true,
			lowercase: true,
			trim: true,
			match: [
				/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
				'Please enter a valid email address',
			],
		},
		password: {
			type: String,
			required: [true, 'Password is required'],
			minlength: [6, 'Password must be at least 6 characters'],
		},
		// We do NOT store confirmPassword in the DB. We'll use a virtual for validation.
	},
	{
		timestamps: true,
	}
);

userSchema
	.virtual('confirmPassword')
	.get(function () {
		return this._confirmPassword;
	})
	.set(function (value) {
		this._confirmPassword = value;
	});

userSchema.pre('save', async function (next) {
	// Only run this middleware if the document is new OR password was changed
	if (!this.isModified('password')) {
		return next();
	}

	// 1) Confirm that `confirmPassword` was provided
	if (!this._confirmPassword) {
		this.invalidate('confirmPassword', 'Please confirm your password');
		return next(new Error('Missing confirmPassword'));
	}

	// 2) Check if they match
	if (this.password !== this._confirmPassword) {
		this.invalidate('confirmPassword', 'Passwords do not match');
		return next(new Error('Passwords do not match'));
	}

	// 3) Hash the password
	try {
		const saltRounds = 10;
		const hashed = await bcrypt.hash(this.password, saltRounds);
		this.password = hashed;
		// We don’t need confirmPassword in the DB, so no need to store it.
		next();
	} catch (err) {
		return next(err);
	}
});

userSchema.methods.comparePassword = async function (candidatePlainText) {
	return bcrypt.compare(candidatePlainText, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
