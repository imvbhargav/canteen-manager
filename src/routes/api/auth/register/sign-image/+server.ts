import { json } from '@sveltejs/kit';
import { v2 as cloudinary } from 'cloudinary';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import {
	IMAGE_STORAGE_PROVIDER,
	R2_ACCOUNT_ID,
	R2_ACCESS_KEY_ID,
	R2_SECRET_ACCESS_KEY,
	R2_BUCKET_NAME,
	CLOUDINARY_CLOUD_NAME,
	CLOUDINARY_API_KEY,
	CLOUDINARY_API_SECRET
} from '$env/static/private';
import type { RequestHandler } from './$types';

cloudinary.config({
	cloud_name: CLOUDINARY_CLOUD_NAME,
	api_key: CLOUDINARY_API_KEY,
	api_secret: CLOUDINARY_API_SECRET,
	secure: true
});

const r2 = new S3Client({
	region: 'auto',
	endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY
	}
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { accountNumber } = await request.json();

		if (!accountNumber) {
			return json(
				{ success: false, error: 'Account number required for signature context' },
				{ status: 400 }
			);
		}

		const cleanAccount = accountNumber.toUpperCase();

		if (IMAGE_STORAGE_PROVIDER === 'R2') {
			const fileKey = `munchup_credentials/${cleanAccount}`;

			const presignedPost = await createPresignedPost(r2, {
				Bucket: R2_BUCKET_NAME,
				Key: fileKey,
				Conditions: [
					['content-length-range', 0, 5242880], // Maximum file scale constraints up to 5MB
					['starts-with', '$Content-Type', 'image/']
				],
				Expires: 600 // 10 minutes time-to-live context window
			});

			return json({
				success: true,
				provider: 'R2',
				uploadUrl: presignedPost.url,
				fields: presignedPost.fields,
				fileKey
			});
		} else {
			const timestamp = Math.round(new Date().getTime() / 1000);
			const folder = 'munchup_credentials';
			const public_id = cleanAccount;

			const paramsToSign = {
				folder,
				public_id,
				timestamp,
				type: 'private' // Enforces asset access restrictions out-of-the-box
			};

			const signature = cloudinary.utils.api_sign_request(paramsToSign, CLOUDINARY_API_SECRET);

			return json({
				success: true,
				provider: 'CLOUDINARY',
				signature,
				timestamp,
				folder,
				public_id,
				type: 'private',
				apiKey: CLOUDINARY_API_KEY,
				cloudName: CLOUDINARY_CLOUD_NAME
			});
		}
	} catch (error) {
		console.error('Signing allocation fault:', error);
		return json(
			{ success: false, error: 'Internal signature initialization failure' },
			{ status: 500 }
		);
	}
};
